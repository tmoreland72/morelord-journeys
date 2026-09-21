import { MODULE_ID } from "../domain/constants.mjs";
import { updateJourneyDocument } from "./journey-undo-service.mjs";
import { actorIdentity } from "../../../morelord-core/scripts/ui/actor-identity.js";
import { hungerSaveDC, hungerThreshold } from "../domain/supply-rules.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { requestRecipientForActor } from "./client-request-routing-service.mjs";
import { getMorelordSocketChannel, JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";
import { getDCConfiguration } from "../core/journey-settings.mjs";
import { adjustActorExhaustion } from "./actor-exhaustion-service.mjs";
import { clientRollButton } from "../ui/client-roll-dialog.mjs";
import { sendClientRollResult } from "./client-roll-result-service.mjs";

async function addExhaustion(actorUuid, amount = 1) {
  const actor = await fromUuid(actorUuid);
  if (!actor) return;
  await adjustActorExhaustion(actor, amount);
}

class SupplyConsequenceService extends EventTarget {
  #started = false;
  #dialogs = new Map();
  #channel = null;
  #resolving = new Set();

  start() {
    if (this.#started) return;
    this.#started = true;
    this.#channel = getMorelordSocketChannel();
    this.#channel.on("supplySave.request", data => this.#receive({ type: "supplySave.request", ...data }));
    this.#channel.on("supplySave.result", data => this.#receive({ type: "supplySave.result", ...data }), { serialize: JOURNEY_STATE_SERIAL_KEY });
    this.#channel.on("supplySave.resolved", data => this.#receive({ type: "supplySave.resolved", ...data }));
  }

  async begin() {
    if (!game.user.isGM) throw new Error("Only the GM can resolve supply shortages.");
    const journey = await getActiveJourney();
    const supply = journey?.currentDay?.supplyResolution;
    const forage = journey?.currentDay?.foragingResolution;
    if (!supply || !forage) throw new Error("Resolve daily supplies first.");
    if (journey.currentDay?.supplyConsequences) return;
    const foodActors = supply.shortageActorUuids?.food ?? (forage.foodActorUuids ?? forage.failedActorUuids).slice(0, supply.shortages.food);
    const waterActors = supply.shortageActorUuids?.water ?? journey.travelers.slice(0, supply.shortages.water).map(traveler => traveler.actorUuid);
    for (const actorUuid of waterActors) await addExhaustion(actorUuid, 1);
    const hungerResults = [];
    const requests = [];
    for (const traveler of journey.travelers) {
      const actorUuid = traveler.actorUuid;
      const actor = await fromUuid(actorUuid);
      if (!actor) continue;
      if (!foodActors.includes(actorUuid)) {
        await updateJourneyDocument(actor, { "flags.morelord-journeys.daysWithoutFood": 0 }, () => actor.setFlag(MODULE_ID, "daysWithoutFood", 0));
        hungerResults.push({ actorUuid, actorName: actor.name, daysWithoutFood: 0, ateFullMeal: true, exhaustionChange: 0 });
        continue;
      }
      const daysWithoutFood = Number(actor.getFlag(MODULE_ID, "daysWithoutFood") ?? 0) + 1;
      await updateJourneyDocument(actor, { "flags.morelord-journeys.daysWithoutFood": daysWithoutFood }, () => actor.setFlag(MODULE_ID, "daysWithoutFood", daysWithoutFood));
      const conModifier = Number(actor.system?.abilities?.con?.mod ?? 0);
      const threshold = hungerThreshold(conModifier);
      const config = getDCConfiguration();
      const dc = hungerSaveDC(daysWithoutFood, conModifier, { base: config.hungerBase, increase: config.hungerIncrease });
      const saveRequired = dc !== null;
      const automatic = daysWithoutFood >= threshold;
      if (automatic) await addExhaustion(actorUuid, 1);
      hungerResults.push({ actorUuid, actorName: actor.name, daysWithoutFood, threshold, ateFullMeal: false, saveRequired, dc, automatic, exhaustionChange: automatic ? 1 : 0 });
      if (saveRequired) {
        const recipient = dc === 0 ? { user: game.user, fallbackToGM: false } : requestRecipientForActor(actor);
        if (!recipient) continue;
        requests.push({ id: crypto.randomUUID(), journeyId: journey.id, dayNumber: journey.dayNumber, actorUuid, actorName: actor.name, userId: recipient.user.id, fallbackToGM: recipient.fallbackToGM, dc, daysWithoutFood, threshold });
      }
    }
    journey.currentDay.supplyConsequences = { foodActorUuids: foodActors, waterActorUuids: waterActors, hungerResults, results: [], resolved: requests.length === 0, startedAt: Date.now() };
    journey.currentDay.pendingSupplySaves = requests;
    await saveActiveJourney(journey);
    for (const request of requests) {
      if (request.dc === 0) await this.#record(journey, request, { total: null, succeeded: true, automatic: true, automaticReason: "zeroDC", resolvedBy: game.user.id });
      else if (request.userId === game.user.id) await this.#open(request);
      else await this.#channel.executeAsUser("supplySave.request", { request }, request.userId, { context: { journeyId: request.journeyId, requestId: request.id } });
    }
    this.#updated();
  }

  async resend(requestId) {
    if (!game.user.isGM) throw new Error("Only the GM can resend supply saves.");
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingSupplySaves?.find(candidate => candidate.id === requestId);
    if (!request) throw new Error("That Constitution save is no longer pending.");
    const recipient = requestRecipientForActor(await fromUuid(request.actorUuid));
    if (!recipient) throw new Error("No active user is available to roll.");
    request.userId = recipient.user.id;
    request.fallbackToGM = recipient.fallbackToGM;
    await saveActiveJourney(journey);
    if (request.userId === game.user.id) await this.#open(request);
    else await this.#channel.executeAsUser("supplySave.request", { request }, request.userId, { context: { journeyId: request.journeyId, requestId: request.id } });
    this.#updated();
  }

  async autoResolve(requestId, succeeded) {
    if (!game.user.isGM) throw new Error("Only the GM can resolve supply saves.");
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingSupplySaves?.find(candidate => candidate.id === requestId);
    if (!request) throw new Error("That Constitution save is no longer pending.");
    await this.#record(journey, request, { total: null, succeeded, automatic: true });
  }

  async #receive(message) {
    if (message?.type === "supplySave.request" && message.request?.userId === game.user.id) return this.#open(message.request);
    if (message?.type === "supplySave.result" && game.user.isGM) {
      const journey = await getActiveJourney();
      const request = journey?.currentDay?.pendingSupplySaves?.find(candidate => candidate.id === message.requestId);
      if (!request) return { accepted: false, reason: "That supply save is no longer pending." };
      await this.#record(journey, request, message.result);
      return { accepted: true };
    }
    if (message?.type === "supplySave.resolved") {
      const dialog = this.#dialogs.get(message.requestId);
      if (dialog) await dialog.close();
      this.#dialogs.delete(message.requestId);
    }
  }

  async #open(request) {
    const actor = await fromUuid(request.actorUuid);
    if (!actor) return;
    await this.#dialogs.get(request.id)?.close();
    const dialog = new foundry.applications.api.DialogV2({
      classes: ["ml-window", "ml-journeys-dialog"],
      window: { title: "Morelord Journeys — Starvation", icon: "fa-solid fa-heart-pulse" },
      content: `<p>${actorIdentity(actor)} has no food and must make a DC ${request.dc} Constitution saving throw.</p>`,
      modal: false,
      buttons: [clientRollButton(async () => {
        if (typeof actor.rollSavingThrow !== "function") throw new Error(`${actor.name} cannot make a D&D 5e Constitution saving throw.`);
        const native = await actor.rollSavingThrow(
          { ability: "con", target: request.dc },
          { configure: true, title: `${actor.name} — Starvation save DC ${request.dc}` },
          { create: true, data: { flavor: `${actor.name} — Starvation save DC ${request.dc}` } }
        );
        if (!native) return null;
        const roll = Array.isArray(native) ? native[0] : native?.rolls?.[0] ?? native?.roll ?? native;
        const total = Number(roll?.total ?? native?.total ?? Number.NaN);
        if (!Number.isFinite(total)) throw new Error("The Constitution saving throw did not return a numeric total.");
        const result = { total, succeeded: total >= request.dc, automatic: false, resolvedBy: game.user.id };
        if (game.user.isGM) {
          const current = await getActiveJourney();
          const pending = current?.currentDay?.pendingSupplySaves?.find(candidate => candidate.id === request.id);
          if (pending) await this.#record(current, pending, result);
        } else { await sendClientRollResult(this.#channel, "supplySave.result", request, result); this.#dialogs.delete(request.id); }
        return total;
      })]
    });
    this.#dialogs.set(request.id, dialog);
    await dialog.render({ force: true });
  }

  async #record(journey, request, result) {
    if (this.#resolving.has(request.id)) return;
    this.#resolving.add(request.id);
    try {
    journey = await getActiveJourney();
    if (!journey?.currentDay?.pendingSupplySaves?.some(candidate => candidate.id === request.id)) return;
    if (!result.succeeded) await addExhaustion(request.actorUuid, 1);
    journey.currentDay.supplyConsequences.results.push({ actorUuid: request.actorUuid, actorName: request.actorName, dc: request.dc, ...result, exhaustionChange: result.succeeded ? 0 : 1, resolvedAt: Date.now() });
    journey.currentDay.pendingSupplySaves = journey.currentDay.pendingSupplySaves.filter(candidate => candidate.id !== request.id);
    journey.currentDay.supplyConsequences.resolved = journey.currentDay.pendingSupplySaves.length === 0;
    await saveActiveJourney(journey);
    if (request.userId === game.user.id) { await this.#dialogs.get(request.id)?.close(); this.#dialogs.delete(request.id); }
    this.#updated();
    } finally { this.#resolving.delete(request.id); }
  }

  #updated() { this.dispatchEvent(new Event("updated")); }
}

export const supplyConsequenceService = new SupplyConsequenceService();
