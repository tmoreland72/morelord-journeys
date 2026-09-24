import { createJourneyChatRequest, registerJourneyChatRoll } from "./chat-roll-service.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { actorIdentity } from "../../../morelord-core/scripts/ui/actor-identity.js";
import { SupplyManifestService } from "./supply-manifest-service.mjs";
import { requestRecipientForActor } from "./client-request-routing-service.mjs";
import { getMorelordSocketChannel, JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";
import { naturalD20 } from "../domain/d20-roll.mjs";
import { foragingFoodFound, resolveForagingResults } from "../domain/foraging-rules.mjs";
import { clientRollButton } from "../ui/client-roll-dialog.mjs";
import { sendClientRollResult } from "./client-roll-result-service.mjs";
const supplies = new SupplyManifestService();

class ForagingRollService extends EventTarget {
  #started = false;
  #dialogs = new Map();
  #channel = null;

  start() {
    if (this.#started) return;
    this.#started = true;
    this.#channel = getMorelordSocketChannel();
    registerJourneyChatRoll("foraging", {pendingKey:"pendingForagingRolls", phase:"foraging", options:request => ({skill:"sur",advantage:request.rollMode === "advantage",disadvantage:request.rollMode === "disadvantage",title:"Foraging Check"}), apply:async (journey,request,result) => { await this.#record(journey,request,result); } });
    this.#channel.on("foragingRoll.request", data => this.#receive({ type: "foragingRoll.request", ...data }));
    this.#channel.on("foragingRoll.result", data => this.#receive({ type: "foragingRoll.result", ...data }), { serialize: JOURNEY_STATE_SERIAL_KEY });
    this.#channel.on("foragingRoll.resolved", data => this.#receive({ type: "foragingRoll.resolved", ...data }));
  }

  async requestParty() {
    if (!game.user.isGM) throw new Error("Only the GM can request party foraging checks.");
    const journey = await getActiveJourney();
    if (journey?.phase !== "foraging") throw new Error("The journey is not in the Foraging phase.");
    const requests = [];
    for (const traveler of journey.travelers) {
      const actor = game.actors.get(traveler.actorId) ?? game.actors.find(candidate => candidate.uuid === traveler.actorUuid);
      if (!actor) continue;
      const recipient = journey.routeSnapshot.resourcesDC === 0 ? { user: game.user, fallbackToGM: false } : requestRecipientForActor(actor);
      if (!recipient) continue;
      const user = recipient.user;
      requests.push({
        id: crypto.randomUUID(), journeyId: journey.id, dayNumber: journey.dayNumber,
        userId: user.id, fallbackToGM: recipient.fallbackToGM, actorUuid: actor.uuid, actorName: actor.name,
        dc: journey.routeSnapshot.resourcesDC,
        rollMode: journey.currentDay?.pace === "slow" || journey.currentDay?.pace === "stopped" ? "advantage" : journey.currentDay?.pace === "fast" ? "disadvantage" : "normal",
        requestedAt: Date.now()
      });
    }
    if (!requests.length) throw new Error("No active player owns a traveler in this journey.");
    for (const request of requests) request.chatGroupId = requests[0].id;
    journey.currentDay.pendingForagingRolls = requests;
    journey.currentDay.foragingResults = [];
    await saveActiveJourney(journey);
    for (const request of requests) {
      if (request.dc === 0) await this.#record(journey, request, { total: null, succeeded: true, automatic: true, automaticReason: "zeroDC", resolvedBy: game.user.id });
      else await this.#open(request);
    }
    this.#updated();
  }

  async autoResolve(requestId, succeeded) {
    if (!game.user.isGM) throw new Error("Only the GM can override a foraging check.");
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingForagingRolls?.find(candidate => candidate.id === requestId);
    if (!request) throw new Error("That foraging request is no longer pending.");
    const actor = await fromUuid(request.actorUuid);
    const recipient = requestRecipientForActor(actor);
    if (!recipient) throw new Error(`${request.actorName} has no active user available to make the roll.`);
    request.userId = recipient.user.id;
    request.fallbackToGM = recipient.fallbackToGM;
    await this.#record(journey, request, { total: null, succeeded, automatic: true, resolvedBy: game.user.id });
  }

  async resend(requestId) {
    if (!game.user.isGM) throw new Error("Only the GM can resend a foraging check.");
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingForagingRolls?.find(candidate => candidate.id === requestId);
    if (!request) throw new Error("That foraging request is no longer pending.");
    request.resentAt = Date.now();
    request.resendCount = Number(request.resendCount ?? 0) + 1;
    await saveActiveJourney(journey);
    await this.#open(request);
    this.#updated();
  }

  async #receive(message) {
    if (message?.type === "foragingRoll.request" && message.request?.userId === game.user.id) return this.#open(message.request);
    if (message?.type === "foragingRoll.result" && game.user.isGM) {
      const journey = await getActiveJourney();
      const request = journey?.currentDay?.pendingForagingRolls?.find(candidate => candidate.id === message.requestId);
      if (!request) return { accepted: false, reason: "That foraging check is no longer pending." };
      await this.#record(journey, request, message.result);
      return { accepted: true };
    }
    if (message?.type === "foragingRoll.resolved") {
      const dialog = this.#dialogs.get(message.requestId);
      if (dialog) await dialog.close();
      this.#dialogs.delete(message.requestId);
    }
  }

  async #open(request) {
    return createJourneyChatRequest("foraging",request,"Foraging Check");
  }

  async #record(journey, request, result) {
    journey.currentDay.foragingResults ??= [];
    journey.currentDay.foragingResults = journey.currentDay.foragingResults.filter(candidate => candidate.actorUuid !== request.actorUuid);
    const foodFound = result.foodFound ?? foragingFoodFound(result);
    journey.currentDay.foragingResults.push({ requestId: request.id, actorUuid: request.actorUuid, actorName: request.actorName, dc: request.dc, ...result, foodFound, resolvedAt: Date.now() });
    journey.currentDay.pendingForagingRolls = (journey.currentDay.pendingForagingRolls ?? []).filter(candidate => candidate.id !== request.id);
    const successes = journey.currentDay.foragingResults.filter(candidate => candidate.succeeded);
    journey.currentDay.foragingResolution = {
      ...resolveForagingResults(journey.travelers, journey.currentDay.foragingResults),
      resourcesDC: journey.routeSnapshot.resourcesDC,
      resolvedAt: Date.now()
    };
    if (journey.currentDay.pendingForagingRolls.length === 0) {
      const travelerUuids = journey.travelers.map(traveler => traveler.actorUuid);
      const partyActorUuid = journey.partyActorUuid
        ?? journey.supplies?.partyActorUuid
        ?? supplies.findPartyActor(travelerUuids)?.uuid
        ?? null;
      journey.currentDay.foragingResolution.refilledWaterContainers = successes.length
        ? await supplies.refillWaterContainers([...travelerUuids, partyActorUuid])
        : [];
      journey.currentDay.foragingResolution.excessRationsAdded = await supplies.addRations(journey.currentDay.foragingResolution.excessFoodByActorUuid);
      journey.supplies = await supplies.build({
        travelerUuids,
        partyActorUuid
      });
      journey.currentDay.supplyResolution = null;
    }
    await saveActiveJourney(journey);
    if (request.userId === game.user.id) { await this.#dialogs.get(request.id)?.close(); this.#dialogs.delete(request.id); }
    this.#updated();
  }

  #updated() { this.dispatchEvent(new Event("updated")); }
}

export const foragingRollService = new ForagingRollService();
