import { createJourneyChatRequest, registerJourneyChatRoll } from "./chat-roll-service.mjs";
import { actorIdentity } from "../../../morelord-core/scripts/ui/actor-identity.js";
import { nightEncounterTiming } from "../domain/encounter-rules.mjs";
import { campWatchTiming } from "../domain/camp-watch-rules.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { requestRecipientForActor, activeGM } from "./client-request-routing-service.mjs";
import { getMorelordSocketChannel, JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";
import { clientRollButton } from "../ui/client-roll-dialog.mjs";
import { sendClientRollResult } from "./client-roll-result-service.mjs";

class CampPerceptionRollService extends EventTarget {
  #started = false;
  #dialogs = new Map();
  #channel = null;

  start() {
    if (this.#started) return;
    this.#started = true;
    this.#channel = getMorelordSocketChannel();
    registerJourneyChatRoll("watch", {pendingKey:"pendingCampPerceptionRolls", phase:"camp", options:request => ({skill:"prc",disadvantage:request.disadvantage,title:`Watch Perception · ${request.timing}`}), apply:async (journey,request,result) => { return this.#receive({type:"campPerception.result",requestId:request.id,result:{...result,userId:result.resolvedBy,action:request.action,disadvantage:request.disadvantage}},{senderUserId:request.userId}); } });
    this.#channel.on("campPerception.request", (data, execution) => {
      if (game.users.get(execution.senderUserId)?.isGM) return this.#receive({ type: "campPerception.request", ...data });
    });
    this.#channel.on("campPerception.result", (data, execution) => this.#receive({ type: "campPerception.result", ...data }, execution), { serialize: JOURNEY_STATE_SERIAL_KEY });
    this.#channel.on("campPerception.resend", async ({ requestId }, execution) => {
      if (!game.user.isGM || !game.users.get(execution.senderUserId)?.isGM) throw new Error("Only a GM may resend watch checks.");
      const journey = await getActiveJourney();
      const request = journey?.currentDay?.pendingCampPerceptionRolls?.find(entry => entry.id === requestId);
      if (!request || journey.phase !== "camp") return;
      const recipient = requestRecipientForActor(await fromUuid(request.actorUuid));
      if (!recipient) throw new Error("No active user can roll this watch check.");
      request.userId = recipient.user.id;
      request.fallbackToGM = recipient.fallbackToGM;
      await saveActiveJourney(journey);
      await this.#open(request);
    }, { serialize: JOURNEY_STATE_SERIAL_KEY });
    this.#channel.on("campPerception.resolved", data => this.#receive({ type: "campPerception.resolved", ...data }));
  }

  async resend(requestId) {
    if (!game.user.isGM) throw new Error("Only a GM may resend watch checks.");
    return this.#channel.executeAsUser("campPerception.resend", { requestId }, activeGM()?.id ?? game.user.id);
  }

  async request({ watchIndex, actorUuid, action = "Take a Watch" }) {
    if (!game.user.isGM) throw new Error("Only the GM can request a camp Perception check.");
    const journey = await getActiveJourney();
    const actor = await fromUuid(actorUuid);
    if (!journey?.currentDay || journey.phase !== "camp" || !actor) throw new Error("The assigned watcher could not be found.");
    const existing = journey.currentDay.pendingCampPerceptionRolls?.find(entry => entry.watchIndex === watchIndex);
    if (existing) return this.resend(existing.id);
    if (journey.currentDay.campPerceptionResults?.some(entry => entry.watchIndex === watchIndex)) return;
    const recipient = requestRecipientForActor(actor);
    if (!recipient) throw new Error(`${actor.name} has no active user available to make the roll.`);
    const request = { id: crypto.randomUUID(), journeyId: journey.id, dayNumber: journey.dayNumber, watchIndex, actorUuid, actorName: actor.name, userId: recipient.user.id, fallbackToGM: recipient.fallbackToGM, action, disadvantage: action !== "Take a Watch", requestedAt: Date.now() };
    request.timing = journey.currentDay.nightEncounterCheck?.encounters?.filter(entry => entry.watchIndex === watchIndex).map(nightEncounterTiming).join("; ") || campWatchTiming(watchIndex);
    journey.currentDay.pendingCampPerceptionRolls ??= [];
    journey.currentDay.pendingCampPerceptionRolls = journey.currentDay.pendingCampPerceptionRolls.filter(entry => entry.watchIndex !== watchIndex);
    journey.currentDay.pendingCampPerceptionRolls.push(request);
    await saveActiveJourney(journey);
    await this.#open(request);
    this.#updated();
    return request;
  }

  async #receive(message, execution) {
    if (message?.type === "campPerception.request" && message.request?.userId === game.user.id) return this.#open(message.request);
    if (message?.type === "campPerception.result" && game.user.isGM) {
      const journey = await getActiveJourney();
      const pending = journey?.currentDay?.pendingCampPerceptionRolls ?? [];
      const request = pending.find(entry => entry.id === message.requestId);
      if (!request || journey.phase !== "camp" || request.journeyId !== journey.id || request.dayNumber !== journey.dayNumber) return { accepted: false, reason: "That camp Perception check is no longer pending." };
      if (execution?.senderUserId !== request.userId || !Number.isFinite(message.result?.total)) return { accepted: false, reason: "Invalid watch result or recipient." };
      journey.currentDay.campPerceptionResults ??= [];
      journey.currentDay.campPerceptionResults = journey.currentDay.campPerceptionResults.filter(entry => entry.watchIndex !== request.watchIndex);
      journey.currentDay.campPerceptionResults.push({ ...message.result, watchIndex: request.watchIndex, actorUuid: request.actorUuid, actorName: request.actorName, resolvedAt: Date.now() });
      journey.currentDay.pendingCampPerceptionRolls = pending.filter(entry => entry.id !== request.id);
      await saveActiveJourney(journey);
      this.#updated();
      return { accepted: true };
    }
    if (message?.type === "campPerception.resolved") {
      await this.#dialogs.get(message.requestId)?.close();
      this.#dialogs.delete(message.requestId);
    }
  }

  async #open(request) {
    return createJourneyChatRequest("watch",request,`Watch Perception · ${request.timing}`);
  }

  #updated() { this.dispatchEvent(new Event("updated")); }
}

export const campPerceptionRollService = new CampPerceptionRollService();
