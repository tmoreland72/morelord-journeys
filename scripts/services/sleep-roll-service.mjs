import { actorIdentity } from "../../../morelord-core/scripts/ui/actor-identity.js";
import { campPeriods, availableCampSleepHours } from "../domain/camp-watch-rules.mjs";
import { evaluateRest2024 } from "../domain/rest-2024.mjs";
import { getDCConfiguration, suppressSleepDeprivationExhaustion } from "../core/journey-settings.mjs";
import { MODULE_ID } from "../domain/constants.mjs";
import { qualifiesForLongRest, sleepDeprivationDC } from "../domain/sleep-rules.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { requestRecipientForActor } from "./client-request-routing-service.mjs";
import { peacefulRestService } from "./peaceful-rest-service.mjs";
import { getMorelordSocketChannel, JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";
import { adjustActorExhaustion } from "./actor-exhaustion-service.mjs";
import { clientRollButton } from "../ui/client-roll-dialog.mjs";
import { sendClientRollResult } from "./client-roll-result-service.mjs";

class SleepRollService extends EventTarget {
  #started = false;
  #dialogs = new Map();
  #openingDialogs = new Set();
  #channel = null;
  #requestingParty = false;
  #resultQueue = Promise.resolve();

  start() {
    if (this.#started) return;
    this.#started = true;
    this.#channel = getMorelordSocketChannel();
    this.#channel.on("sleepRoll.request", data => this.#receive({ type: "sleepRoll.request", ...data }));
    this.#channel.on("sleepRoll.result", data => this.#receive({ type: "sleepRoll.result", ...data }), { serialize: JOURNEY_STATE_SERIAL_KEY });
    this.#channel.on("sleepRoll.resolved", data => this.#receive({ type: "sleepRoll.resolved", ...data }));
  }

  async requestParty(plan) {
    if (!game.user.isGM) throw new Error("Only the GM can request sleep checks.");
    if (this.#requestingParty) throw new Error("Sleep check requests are already being sent.");
    this.#requestingParty = true;
    try {
      const journey = await getActiveJourney();
      if (journey?.phase !== "sleep") throw new Error("The journey is not in the Sleep & Shelter phase.");
      if (journey.currentDay?.pendingSleepRolls?.length || journey.currentDay?.campSleepResults?.length) throw new Error("Sleep checks have already been requested for this travel day.");
      const requests = [];
      const seenActors = new Set();
      for (const entry of plan?.entries ?? []) {
        entry.sleepHours = Math.min(Number(entry.sleepHours ?? 8), availableCampSleepHours(journey.currentDay?.campWatches, entry.actorUuid));
        if (seenActors.has(entry.actorUuid)) continue;
        seenActors.add(entry.actorUuid);
        const actor = await fromUuid(entry.actorUuid);
        if (!actor) throw new Error(`Cannot resolve rest: ${entry.actorName} is unavailable.`);
        entry.restAssessment = evaluateRest2024({ ...entry,
          assignment: journey.currentDay?.campWatches?.find(item => item.actorUuid === entry.actorUuid) });
        entry.sleepHours = entry.restAssessment.sleepHours;
        entry.interruptionHours = entry.restAssessment.interruptionHours;
        entry.interruptionSources = entry.restAssessment.interruptionSources;
        const recipient = { user: game.user, fallbackToGM: false };
        requests.push(this.#requestData({ journey, entry, actor, recipient, kind: "sleep", dc: 0 }));
      }
      if (!requests.length) throw new Error("No active user is available to make the sleep checks.");
      journey.currentDay.pendingSleepRolls = requests;
      journey.currentDay.campSleepResults = [];
      journey.currentDay.completedSleepRequestIds = [];
      await saveActiveJourney(journey);
      for (const request of requests) await this.#dispatch(request);
      this.#updated();
    } finally {
      this.#requestingParty = false;
    }
  }

  async resend(requestId) {
    if (!game.user.isGM) throw new Error("Only the GM can resend sleep checks.");
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingSleepRolls?.find(item => item.id === requestId);
    if (!request) throw new Error("That sleep check is no longer pending.");
    const actor = await fromUuid(request.actorUuid);
    const recipient = requestRecipientForActor(actor);
    if (!recipient) throw new Error(`${request.actorName} has no active user available to make the roll.`);
    request.userId = recipient.user.id;
    request.fallbackToGM = recipient.fallbackToGM;
    request.resentAt = Date.now();
    request.resendCount = Number(request.resendCount ?? 0) + 1;
    await saveActiveJourney(journey);
    await this.#dispatch(request, { replace: true });
    this.#updated();
  }

  async autoResolve(requestId, succeeded) {
    if (!game.user.isGM) throw new Error("Only the GM can resolve sleep checks manually.");
    await this.#recordResult(requestId, { total: null, succeeded, automatic: true, resolvedBy: game.user.id });
  }

  #requestData({ journey, entry, actor, recipient, kind, dc, sleepResult = null }) {
    return {
      id: crypto.randomUUID(), journeyId: journey.id, dayNumber: journey.dayNumber,
      kind, actorUuid: actor.uuid, actorName: actor.name, userId: recipient.user.id,
      fallbackToGM: recipient.fallbackToGM, dc, advantage: kind === "sleep" && journey.currentDay?.pace === "stopped",
      entry, sleepResult, requestedAt: Date.now()
    };
  }

  async #dispatch(request, { replace = false } = {}) {
    if (request.kind === "sleep" && request.entry.restAssessment) return this.#recordResult(request.id, { total: null, succeeded: true, automatic: true, automaticReason: "rules2024", resolvedBy: game.user.id });
    if (request.dc === 0) return this.#recordResult(request.id, { total: null, succeeded: true, automatic: true, automaticReason: "zeroDC", resolvedBy: game.user.id });
    if (request.userId === game.user.id) await this.#open(request, { replace });
    else await this.#channel.executeAsUser("sleepRoll.request", { request }, request.userId, { context: { journeyId: request.journeyId, requestId: request.id } });
  }

  async #receive(message) {
    if (message?.type === "sleepRoll.request" && message.request?.userId === game.user.id) return this.#open(message.request);
    if (message?.type === "sleepRoll.result" && game.user.isGM) {
      const accepted = await this.#recordResult(message.requestId, message.result);
      return accepted ? { accepted: true } : { accepted: false, reason: "That sleep check is no longer pending." };
    }
    if (message?.type === "sleepRoll.resolved") {
      await this.#dialogs.get(message.requestId)?.close();
      this.#dialogs.delete(message.requestId);
    }
  }

  async #open(request, { replace = false } = {}) {
    if ((this.#dialogs.has(request.id) || this.#openingDialogs.has(request.id)) && !replace) return;
    this.#openingDialogs.add(request.id);
    try {
      if (replace) await this.#dialogs.get(request.id)?.close();
      const actor = await fromUuid(request.actorUuid);
      if (!actor) return;
      const label = request.kind === "sleep" ? "Camp Sleep Check" : "Separate Sleep-Deprivation Save";
      const dialog = new foundry.applications.api.DialogV2({
      classes: ["ml-window", "ml-journeys-dialog"],
      window: { title: `Morelord Journeys — ${label}`, icon: "fa-solid fa-bed" },
      content: `<p>${actorIdentity(request)} must make a DC ${request.dc} Constitution saving throw for ${label.toLowerCase()}.</p>`,
      modal: false,
      buttons: [clientRollButton(async () => {
        const native = await actor.rollSavingThrow(
          { ability: "con", target: request.dc, advantage: request.advantage },
          { configure: true, title: `${request.actorName} — ${label} DC ${request.dc}` },
          { create: true, data: { flavor: `${request.actorName} — ${label} DC ${request.dc}` } }
        );
        if (!native) return null;
        const roll = Array.isArray(native) ? native[0] : native?.rolls?.[0] ?? native?.roll ?? native;
        const total = Number(roll?.total ?? native?.total ?? Number.NaN);
        if (!Number.isFinite(total)) throw new Error("The Constitution saving throw did not return a numeric total.");
        const result = { total, succeeded: total >= request.dc, automatic: false, resolvedBy: game.user.id };
        if (game.user.isGM) {
          await this.#recordResult(request.id, result);
        } else {
          await sendClientRollResult(this.#channel, "sleepRoll.result", request, result);
          this.#dialogs.delete(request.id);
        }
        return total;
      })]
    });
      this.#dialogs.set(request.id, dialog);
      await dialog.render({ force: true });
    } finally {
      this.#openingDialogs.delete(request.id);
    }
  }

  async #recordResult(requestId, result) {
    const operation = async () => {
      const journey = await getActiveJourney();
      const request = journey?.currentDay?.pendingSleepRolls?.find(item => item.id === requestId);
      if (!request) return Boolean(journey?.currentDay?.completedSleepRequestIds?.includes(requestId));
      await this.#accept(journey, request, result);
      return true;
    };
    const queued = this.#resultQueue.then(operation, operation);
    this.#resultQueue = queued.catch(() => undefined);
    return queued;
  }

  async #accept(journey, request, result) {
    if (request.userId === game.user.id) {
      await this.#dialogs.get(request.id)?.close();
      this.#dialogs.delete(request.id);
    }
    journey.currentDay.pendingSleepRolls = (journey.currentDay.pendingSleepRolls ?? []).filter(item => item.id !== request.id);
    journey.currentDay.completedSleepRequestIds ??= [];
    if (!journey.currentDay.completedSleepRequestIds.includes(request.id)) journey.currentDay.completedSleepRequestIds.push(request.id);
    if (request.kind === "sleep") {
      const longRestCompleted = request.entry.restAssessment?.longRestCompleted ?? qualifiesForLongRest({
        sleepCheckSucceeded: result.succeeded,
        sleepHours: request.entry.sleepHours,
        requiredSleepHours: request.entry.requiredSleepHours,
        interruptionHours: request.entry.interruptionHours
      });
      if (!longRestCompleted && !suppressSleepDeprivationExhaustion()) {
        const actor = await fromUuid(request.actorUuid);
        const daysWithoutLongRest = Number(actor?.getFlag(MODULE_ID, "daysWithoutLongRest") ?? 0) + 1;
        const recipient = requestRecipientForActor(actor);
        const config = getDCConfiguration();
        const deprivation = this.#requestData({ journey, entry: request.entry, actor, recipient, kind: "deprivation", dc: sleepDeprivationDC(daysWithoutLongRest, { base: config.sleepDeprivationBase, increase: config.sleepDeprivationIncrease }), sleepResult: { ...result, advantage: request.advantage, longRestCompleted, daysWithoutLongRest } });
        journey.currentDay.pendingSleepRolls.push(deprivation);
        await saveActiveJourney(journey);
        setTimeout(() => void this.#dispatch(deprivation).catch(error => {
          console.error("Morelord Journeys | Unable to dispatch sleep-deprivation save.", error);
          ui.notifications.error(error.message);
        }), 0);
        this.#updated();
        return;
      }
      await this.#finalize(journey, request, { ...result, longRestCompleted }, null);
    } else {
      await this.#finalize(journey, request, request.sleepResult, { dc: request.dc, total: result.total, succeeded: result.succeeded, automatic: result.automatic, automaticReason: result.automaticReason });
    }
  }

  async #finalize(journey, request, sleepResult, deprivation) {
    const actor = await fromUuid(request.actorUuid);
    const entry = request.entry;
    const consequences = journey.currentDay?.supplyConsequences ?? { foodActorUuids: [], waterActorUuids: [] };
    const wasFedAndWatered = !consequences.foodActorUuids.includes(entry.actorUuid) && !consequences.waterActorUuids.includes(entry.actorUuid);
    let daysWithoutLongRest = sleepResult.longRestCompleted ? 0 : Number(sleepResult.daysWithoutLongRest ?? Number(actor.getFlag(MODULE_ID, "daysWithoutLongRest") ?? 0) + 1);
    await actor.setFlag(MODULE_ID, "daysWithoutLongRest", daysWithoutLongRest);
    let requestedExhaustionChange = sleepResult.longRestCompleted && wasFedAndWatered ? -1 : 0;
    if (deprivation && !deprivation.succeeded) requestedExhaustionChange += 1;
    const exhaustionUpdate = await adjustActorExhaustion(actor, requestedExhaustionChange);
    const exhaustionChange = exhaustionUpdate.change;
    const consequence = sleepResult.longRestCompleted
      ? wasFedAndWatered ? exhaustionChange < 0 ? "completed a Long Rest; Exhaustion reduced by 1" : "completed a Long Rest; no Exhaustion level remained to remove" : "completed a Long Rest, but food or water shortage prevents Exhaustion recovery"
      : deprivation?.succeeded ? "did not complete a Long Rest; passed the sleep-deprivation save"
        : deprivation ? "did not complete a Long Rest; failed the sleep-deprivation save and gained 1 Exhaustion"
          : "did not complete a Long Rest; no Long Rest benefits and sleep-deprivation Exhaustion is disabled";
    journey.currentDay.campSleepResults ??= [];
    journey.currentDay.campSleepResults = journey.currentDay.campSleepResults.filter(item => item.actorUuid !== actor.uuid);
    journey.currentDay.campSleepResults.push({ restAssessment: entry.restAssessment ?? null, requestId: request.id, actorUuid: actor.uuid, actorName: actor.name, baseDC: entry.baseDC, modifiers: entry.modifiers, dc: entry.dc, total: sleepResult.total, automatic: sleepResult.automatic, automaticReason: sleepResult.automaticReason, advantage: sleepResult.advantage ?? request.advantage, sleepHours: entry.sleepHours, requiredSleepHours: entry.requiredSleepHours ?? 6, requiredSleepHoursSource: entry.requiredSleepHoursSource ?? "Standard Long Rest sleep requirement", interruptionHours: entry.interruptionHours, interruptionSources: entry.interruptionSources ?? [], longRestCompleted: sleepResult.longRestCompleted, daysWithoutLongRest, deprivation: deprivation ?? { suppressed: true }, fed: !consequences.foodActorUuids.includes(entry.actorUuid), watered: !consequences.waterActorUuids.includes(entry.actorUuid), succeeded: sleepResult.succeeded, exhaustionChange, consequence });
    await saveActiveJourney(journey);
    if (!journey.currentDay.pendingSleepRolls.length) await this.#completeParty(journey);
    this.#updated();
  }

  async #completeParty(journey) {
    const results = journey.currentDay.campSleepResults ?? [];
    const peacefulNight = journey.currentDay?.nightEncounterCheck?.outcome === "peacefulRest";
    const slumberActors = journey.travelers.filter(traveler => campPeriods(
      journey.currentDay?.campWatches?.find(watch => watch.actorUuid === traveler.actorUuid) ?? { action: "Slumber" }
    ).every(period => !period.watch && period.action === "Slumber")).map(traveler => traveler.actorUuid);
    journey.currentDay.peacefulRestEligible = [...new Set([...(peacefulNight ? results.filter(result => result.longRestCompleted).map(result => result.actorUuid) : []), ...slumberActors].filter(actorUuid => results.some(result => result.actorUuid === actorUuid && result.longRestCompleted)))];
    if (journey.currentDay.nightEncounterCheck) {
      journey.currentDay.nightEncounterCheck.pendingSleepConfirmation = false;
      journey.currentDay.nightEncounterCheck.sleepConfirmedAt = Date.now();
    }
    await saveActiveJourney(journey);
    if (journey.currentDay.peacefulRestEligible.length) setTimeout(() => void peacefulRestService.requestEligible().catch(error => {
      console.error("Morelord Journeys | Unable to offer Peaceful Rest choices.", error);
      ui.notifications.error(error.message);
    }), 0);
  }

  #updated() { this.dispatchEvent(new Event("updated")); }
}

export const sleepRollService = new SleepRollService();
