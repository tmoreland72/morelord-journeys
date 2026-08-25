import { MODULE_ID } from "../domain/constants.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";

const SOCKET = `module.${MODULE_ID}`;
const CHOICES = Object.freeze({
  firstSaveAdvantage: "Advantage on the first saving throw tomorrow",
  exhaustion: "Remove one additional level of Exhaustion",
  inspiration: "Gain Heroic Inspiration"
});

class PeacefulRestService extends EventTarget {
  #started = false;
  #dialogs = new Map();
  start() { if (!this.#started) { this.#started = true; game.socket.on(SOCKET, message => void this.#receive(message)); } }

  async requestEligible() {
    if (!game.user.isGM) throw new Error("Only the GM can offer Peaceful Rest benefits.");
    const journey = await getActiveJourney();
    const existing = new Set((journey.currentDay?.peacefulRestChoices ?? []).map(choice => choice.actorUuid));
    const requests = [];
    for (const actorUuid of journey.currentDay?.peacefulRestEligible ?? []) {
      if (existing.has(actorUuid)) continue;
      const actor = await fromUuid(actorUuid);
      if (!actor) continue;
      const user = game.users.find(candidate => candidate.active && !candidate.isGM && (candidate.character?.uuid === actor.uuid || actor.testUserPermission?.(candidate, "OWNER"))) ?? game.user;
      requests.push({ id: crypto.randomUUID(), actorUuid, actorName: actor.name, userId: user.id });
    }
    journey.currentDay.pendingPeacefulRestChoices = requests;
    await saveActiveJourney(journey);
    for (const request of requests) request.userId === game.user.id ? await this.#open(request) : game.socket.emit(SOCKET, { type: "peacefulRest.request", request });
    this.#updated();
  }

  async resend(requestId) {
    if (!game.user.isGM) throw new Error("Only the GM can resend Peaceful Rest choices.");
    const journey = await getActiveJourney();
    const request = journey.currentDay?.pendingPeacefulRestChoices?.find(item => item.id === requestId);
    if (!request) throw new Error("That Peaceful Rest choice is no longer pending.");
    request.resentAt = Date.now();
    request.resendCount = Number(request.resendCount ?? 0) + 1;
    await saveActiveJourney(journey);
    if (request.userId === game.user.id) await this.#open(request, { replace: true });
    else game.socket.emit(SOCKET, { type: "peacefulRest.request", request });
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
      } else game.socket.emit(SOCKET, { type: "peacefulRest.result", requestId: request.id, choice: action, resolvedBy: game.user.id });
      return action;
    } }));
    const dialog = new foundry.applications.api.DialogV2({ window: { title: "Morelord Journeys — Peaceful Rest", icon: "fa-solid fa-bed" }, content: `<p><strong>${foundry.utils.escapeHTML(request.actorName)}</strong> receives a Peaceful Rest benefit. Choose one; Journeys records but does not apply it.</p>`, modal: false, buttons });
    this.#dialogs.set(request.id, dialog);
    await dialog.render({ force: true });
  }

  async #record(journey, request, choice, { resolvedBy = null, automatic = false } = {}) {
    journey.currentDay.peacefulRestChoices ??= [];
    journey.currentDay.peacefulRestChoices = journey.currentDay.peacefulRestChoices.filter(item => item.actorUuid !== request.actorUuid);
    journey.currentDay.peacefulRestChoices.push({ actorUuid: request.actorUuid, actorName: request.actorName, choice, label: CHOICES[choice], appliedAutomatically: false, automatic, resolvedBy, recordedAt: Date.now() });
    journey.currentDay.pendingPeacefulRestChoices = (journey.currentDay.pendingPeacefulRestChoices ?? []).filter(item => item.id !== request.id);
    await saveActiveJourney(journey);
    game.socket.emit(SOCKET, { type: "peacefulRest.resolved", requestId: request.id });
    this.#updated();
  }
  #updated() { this.dispatchEvent(new Event("updated")); }
}

export const peacefulRestService = new PeacefulRestService();
