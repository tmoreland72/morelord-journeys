import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { requestRecipientForActor } from "./client-request-routing-service.mjs";
import { getMorelordSocketChannel, JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";

class CampPerceptionRollService extends EventTarget {
  #started = false;
  #dialogs = new Map();
  #channel = null;

  start() {
    if (this.#started) return;
    this.#started = true;
    this.#channel = getMorelordSocketChannel();
    this.#channel.on("campPerception.request", data => this.#receive({ type: "campPerception.request", ...data }));
    this.#channel.on("campPerception.result", data => this.#receive({ type: "campPerception.result", ...data }), { serialize: JOURNEY_STATE_SERIAL_KEY });
    this.#channel.on("campPerception.resolved", data => this.#receive({ type: "campPerception.resolved", ...data }));
  }

  async request({ watchIndex, actorUuid, action = "Take a Watch" }) {
    if (!game.user.isGM) throw new Error("Only the GM can request a camp Perception check.");
    const journey = await getActiveJourney();
    const actor = await fromUuid(actorUuid);
    if (!journey?.currentDay || journey.phase !== "camp" || !actor) throw new Error("The assigned watcher could not be found.");
    const recipient = requestRecipientForActor(actor);
    if (!recipient) throw new Error(`${actor.name} has no active user available to make the roll.`);
    const request = { id: crypto.randomUUID(), journeyId: journey.id, dayNumber: journey.dayNumber, watchIndex, actorUuid, actorName: actor.name, userId: recipient.user.id, fallbackToGM: recipient.fallbackToGM, action, disadvantage: action !== "Take a Watch", requestedAt: Date.now() };
    journey.currentDay.pendingCampPerceptionRolls ??= [];
    journey.currentDay.pendingCampPerceptionRolls = journey.currentDay.pendingCampPerceptionRolls.filter(entry => entry.watchIndex !== watchIndex);
    journey.currentDay.pendingCampPerceptionRolls.push(request);
    await saveActiveJourney(journey);
    if (request.userId === game.user.id) await this.#open(request);
    else await this.#channel.executeAsUser("campPerception.request", { request }, request.userId, { context: { journeyId: request.journeyId, requestId: request.id } });
    this.#updated();
    return request;
  }

  async #receive(message) {
    if (message?.type === "campPerception.request" && message.request?.userId === game.user.id) return this.#open(message.request);
    if (message?.type === "campPerception.result" && game.user.isGM) {
      const journey = await getActiveJourney();
      const pending = journey?.currentDay?.pendingCampPerceptionRolls ?? [];
      const request = pending.find(entry => entry.id === message.requestId);
      if (!request) return;
      journey.currentDay.campPerceptionResults ??= [];
      journey.currentDay.campPerceptionResults = journey.currentDay.campPerceptionResults.filter(entry => entry.watchIndex !== request.watchIndex);
      journey.currentDay.campPerceptionResults.push({ ...message.result, watchIndex: request.watchIndex, actorUuid: request.actorUuid, actorName: request.actorName, resolvedAt: Date.now() });
      journey.currentDay.pendingCampPerceptionRolls = pending.filter(entry => entry.id !== request.id);
      await saveActiveJourney(journey);
      if (request.userId !== game.user.id) await this.#channel.executeAsUser("campPerception.resolved", { requestId: request.id }, request.userId, { context: { journeyId: request.journeyId, requestId: request.id } });
      this.#updated();
    }
    if (message?.type === "campPerception.resolved") {
      await this.#dialogs.get(message.requestId)?.close();
      this.#dialogs.delete(message.requestId);
    }
  }

  async #open(request) {
    if (this.#dialogs.has(request.id)) return;
    const actor = await fromUuid(request.actorUuid);
    if (!actor) return;
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `Morelord Journeys — Watch ${request.watchIndex + 1}`, icon: "fa-solid fa-eye" },
      content: `<p><strong>${foundry.utils.escapeHTML(request.actorName)}</strong> must roll Perception for Watch ${request.watchIndex + 1}. Camp action: ${foundry.utils.escapeHTML(request.action)}.${request.disadvantage ? " Roll with disadvantage because attention is divided." : " Roll normally."}</p>`,
      modal: false,
      buttons: [{ action: "roll", label: "Roll Perception", icon: "fa-solid fa-dice-d20", default: true, callback: async () => {
        const native = await actor.rollSkill({ skill: "prc", disadvantage: request.disadvantage }, { configure: true, title: `${request.actorName} — Camp Watch Perception${request.disadvantage ? " (Disadvantage)" : ""}` }, { create: true, data: { flavor: `Morelord Journeys — Watch ${request.watchIndex + 1} Perception` } });
        if (!native) return null;
        const roll = Array.isArray(native) ? native[0] : native?.rolls?.[0] ?? native?.roll ?? native;
        const total = Number(roll?.total ?? native?.total ?? Number.NaN);
        if (!Number.isFinite(total)) throw new Error("The Perception check did not return a numeric total.");
        const result = { total, userId: game.user.id, action: request.action, disadvantage: request.disadvantage };
        if (game.user.isGM) {
          const journey = await getActiveJourney();
          const pending = journey?.currentDay?.pendingCampPerceptionRolls ?? [];
          const current = pending.find(entry => entry.id === request.id);
          if (current) {
            journey.currentDay.campPerceptionResults ??= [];
            journey.currentDay.campPerceptionResults = journey.currentDay.campPerceptionResults.filter(entry => entry.watchIndex !== current.watchIndex);
            journey.currentDay.campPerceptionResults.push({ ...result, watchIndex: current.watchIndex, actorUuid: current.actorUuid, actorName: current.actorName, resolvedAt: Date.now() });
            journey.currentDay.pendingCampPerceptionRolls = pending.filter(entry => entry.id !== current.id);
            await saveActiveJourney(journey);
            this.#updated();
          }
        } else await this.#channel.executeAsGM("campPerception.result", { requestId: request.id, result }, { context: { journeyId: request.journeyId, requestId: request.id } });
        return total;
      }}]
    });
    this.#dialogs.set(request.id, dialog);
    await dialog.render({ force: true });
  }

  #updated() { this.dispatchEvent(new Event("updated")); }
}

export const campPerceptionRollService = new CampPerceptionRollService();
