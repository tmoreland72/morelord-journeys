import { actorIdentity } from "../../../morelord-core/scripts/ui/actor-identity.js";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { requestRecipientForActor } from "./client-request-routing-service.mjs";
import { getMorelordSocketChannel, JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";
const CHOICES = Object.freeze({
  firstSaveAdvantage: "Advantage on the first saving throw tomorrow",
  exhaustion: "Remove one additional level of Exhaustion",
  inspiration: "Gain Heroic Inspiration"
});

class PeacefulRestService extends EventTarget {
  #started = false;
  #dialogs = new Map();
  #channel = null;
  start() {
    if (this.#started) return;
    this.#started = true;
    this.#channel = getMorelordSocketChannel();
    this.#channel.on("peacefulRest.request", data => this.#receive({ type: "peacefulRest.request", ...data }));
    this.#channel.on("peacefulRest.result", data => this.#receive({ type: "peacefulRest.result", ...data }), { serialize: JOURNEY_STATE_SERIAL_KEY });
    this.#channel.on("peacefulRest.resolved", data => this.#receive({ type: "peacefulRest.resolved", ...data }));
  }

  async requestEligible() {
    if (!game.user.isGM) throw new Error("Only the GM can offer Peaceful Rest benefits.");
    const journey = await getActiveJourney();
    const existing = new Set((journey.currentDay?.peacefulRestChoices ?? []).map(choice => choice.actorUuid));
    const requests = [];
    for (const actorUuid of journey.currentDay?.peacefulRestEligible ?? []) {
      if (existing.has(actorUuid)) continue;
      const actor = await fromUuid(actorUuid);
      if (!actor) continue;
      const recipient = requestRecipientForActor(actor);
      if (!recipient) continue;
      requests.push({ id: crypto.randomUUID(), journeyId: journey.id, dayNumber: journey.dayNumber, actorUuid, actorName: actor.name, userId: recipient.user.id, fallbackToGM: recipient.fallbackToGM });
    }
    journey.currentDay.pendingPeacefulRestChoices = requests;
    await saveActiveJourney(journey);
    for (const request of requests) {
      if (request.userId === game.user.id) await this.#open(request);
      else await this.#channel.executeAsUser("peacefulRest.request", { request }, request.userId, { context: { journeyId: request.journeyId, requestId: request.id } });
    }
    this.#updated();
  }

  async resend(requestId) {
    if (!game.user.isGM) throw new Error("Only the GM can resend Peaceful Rest choices.");
    const journey = await getActiveJourney();
    const request = journey.currentDay?.pendingPeacefulRestChoices?.find(item => item.id === requestId);
    if (!request) throw new Error("That Peaceful Rest choice is no longer pending.");
    const actor = await fromUuid(request.actorUuid);
    const recipient = requestRecipientForActor(actor);
    if (!recipient) throw new Error(`${request.actorName} has no active user available to choose.`);
    request.userId = recipient.user.id;
    request.fallbackToGM = recipient.fallbackToGM;
    request.resentAt = Date.now();
    request.resendCount = Number(request.resendCount ?? 0) + 1;
    await saveActiveJourney(journey);
    if (request.userId === game.user.id) await this.#open(request, { replace: true });
    else await this.#channel.executeAsUser("peacefulRest.request", { request }, request.userId, { context: { journeyId: request.journeyId, requestId: request.id } });
    this.#updated();
  }

  async autoResolve(requestId, choice) {
    if (!game.user.isGM) throw new Error("Only the GM can set a Peaceful Rest choice manually.");
    if (!(choice in CHOICES)) throw new Error("Select a valid Peaceful Rest benefit.");
    const journey = await getActiveJourney();
    const request = journey.currentDay?.pendingPeacefulRestChoices?.find(item => item.id === requestId);
    if (!request) throw new Error("That Peaceful Rest choice is no longer pending.");
    await this.#record(journey, request, choice, { resolvedBy: game.user.id, automatic: true });
  }

  async #receive(message) {
    if (message?.type === "peacefulRest.request" && message.request?.userId === game.user.id) return this.#open(message.request);
    if (message?.type === "peacefulRest.result" && game.user.isGM) {
      const journey = await getActiveJourney();
      const request = journey.currentDay?.pendingPeacefulRestChoices?.find(item => item.id === message.requestId);
      if (request && message.choice in CHOICES) await this.#record(journey, request, message.choice, { resolvedBy: message.resolvedBy });
    }
    if (message?.type === "peacefulRest.resolved") { await this.#dialogs.get(message.requestId)?.close(); this.#dialogs.delete(message.requestId); }
  }

  async #open(request, { replace = false } = {}) {
    if (this.#dialogs.has(request.id) && !replace) return;
    if (replace) await this.#dialogs.get(request.id)?.close();
    const buttons = Object.entries(CHOICES).map(([action, label], index) => ({ action, label, default: index === 0, callback: async () => {
      if (game.user.isGM) {
        const journey = await getActiveJourney();
        const pending = journey.currentDay?.pendingPeacefulRestChoices?.find(item => item.id === request.id);
        if (pending) await this.#record(journey, pending, action, { resolvedBy: game.user.id });
      } else await this.#channel.executeAsGM("peacefulRest.result", { requestId: request.id, choice: action, resolvedBy: game.user.id }, { context: { journeyId: request.journeyId, requestId: request.id } });
      return action;
    } }));
    const dialog = new foundry.applications.api.DialogV2({
      classes: ["ml-window", "ml-journeys-dialog"], position: { width: 860, height: "auto" }, window: { resizable: true, title: "Morelord Journeys — Peaceful Rest", icon: "fa-solid fa-bed" }, content: `<p>${actorIdentity(request)} receives a Peaceful Rest benefit. Choose one. Heroic Inspiration is applied to the character sheet; other benefits are recorded for manual application.</p>`, modal: false, buttons });
    this.#dialogs.set(request.id, dialog);
    await dialog.render({ force: true });
  }

  async #record(journey, request, choice, { resolvedBy = null, automatic = false } = {}) {
    if (!(journey.currentDay.pendingPeacefulRestChoices ?? []).some(item => item.id === request.id)) return;
    if (choice === "inspiration") {
      const actor = await fromUuid(request.actorUuid);
      if (!actor) throw new Error("The character is unavailable; the benefit remains pending.");
      await actor.update({ "system.attributes.inspiration": true });
    }
    journey.currentDay.peacefulRestChoices ??= [];
    journey.currentDay.peacefulRestChoices = journey.currentDay.peacefulRestChoices.filter(item => item.actorUuid !== request.actorUuid);
    journey.currentDay.peacefulRestChoices.push({ actorUuid: request.actorUuid, actorName: request.actorName, choice, label: CHOICES[choice], appliedAutomatically: choice === "inspiration", automatic, resolvedBy, recordedAt: Date.now() });
    journey.currentDay.pendingPeacefulRestChoices = (journey.currentDay.pendingPeacefulRestChoices ?? []).filter(item => item.id !== request.id);
    await saveActiveJourney(journey);
    if (request.userId !== game.user.id) await this.#channel.executeAsUser("peacefulRest.resolved", { requestId: request.id }, request.userId, { context: { journeyId: request.journeyId, requestId: request.id } });
    this.#updated();
  }
  #updated() { this.dispatchEvent(new Event("updated")); }
}

export const peacefulRestService = new PeacefulRestService();
