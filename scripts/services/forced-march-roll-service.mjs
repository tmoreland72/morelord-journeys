import { MODULE_ID } from "../domain/constants.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";

const SOCKET = `module.${MODULE_ID}`;

class ForcedMarchRollService extends EventTarget {
  #started = false;
  #dialogs = new Map();

  start() {
    if (this.#started) return;
    this.#started = true;
    game.socket.on(SOCKET, message => void this.#receive(message));
  }

  async requestParty() {
    if (!game.user.isGM) throw new Error("Only the GM can request forced-march saves.");
    const journey = await getActiveJourney();
    if (journey?.phase !== "pressOn") throw new Error("The journey is not in the Press On phase.");
    if (journey.currentDay?.pace === "stopped") throw new Error("A stopped party cannot press on.");
    const requests = [];
    for (const traveler of journey.travelers) {
      const actor = await fromUuid(traveler.actorUuid);
      if (!actor) continue;
      const user = game.users.find(candidate => candidate.active && !candidate.isGM && (candidate.character?.uuid === actor.uuid || actor.testUserPermission?.(candidate, "OWNER"))) ?? game.user;
      requests.push({ id: crypto.randomUUID(), actorUuid: actor.uuid, actorName: actor.name, userId: user.id, dc: 12 });
    }
    journey.currentDay.pendingForcedMarchRolls = requests;
    journey.currentDay.forcedMarchResults = [];
    await saveActiveJourney(journey);
    for (const request of requests) {
      if (request.userId === game.user.id) await this.#open(request);
      else game.socket.emit(SOCKET, { type: "forcedMarch.request", request });
    }
    this.#updated();
  }

  async autoResolve(requestId, succeeded) {
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingForcedMarchRolls?.find(candidate => candidate.id === requestId);
    if (!request) throw new Error("That forced-march save is no longer pending.");
    await this.#record(journey, request, { total: null, succeeded, automatic: true });
  }

  async resend(requestId) {
    if (!game.user.isGM) throw new Error("Only the GM can resend forced-march saves.");
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingForcedMarchRolls?.find(candidate => candidate.id === requestId);
    if (!request) throw new Error("That forced-march save is no longer pending.");
    request.resentAt = Date.now();
    request.resendCount = Number(request.resendCount ?? 0) + 1;
    await saveActiveJourney(journey);
    if (request.userId === game.user.id) await this.#open(request, { replace: true });
    else game.socket.emit(SOCKET, { type: "forcedMarch.request", request });
    this.#updated();
  }

  async #receive(message) {
    if (message?.type === "forcedMarch.request" && message.request?.userId === game.user.id) return this.#open(message.request);
    if (message?.type === "forcedMarch.result" && game.user.isGM) {
      const journey = await getActiveJourney();
      const request = journey?.currentDay?.pendingForcedMarchRolls?.find(candidate => candidate.id === message.requestId);
      if (request) await this.#record(journey, request, message.result);
    }
    if (message?.type === "forcedMarch.resolved") {
      await this.#dialogs.get(message.requestId)?.close();
      this.#dialogs.delete(message.requestId);
    }
  }

  async #open(request, { replace = false } = {}) {
    if (this.#dialogs.has(request.id) && !replace) return;
    if (replace) await this.#dialogs.get(request.id)?.close();
    const actor = await fromUuid(request.actorUuid);
    if (!actor) return;
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: "Morelord Journeys — Forced March", icon: "fa-solid fa-person-running" },
      content: `<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong> presses on for two more hours and must make a DC 12 Constitution saving throw.</p>`,
      modal: false,
      buttons: [{ action: "roll", label: "Roll Constitution Save", default: true, callback: async () => {
        if (typeof actor.rollSavingThrow !== "function") throw new Error(`${actor.name} cannot make a D&D 5e Constitution saving throw.`);
        const native = await actor.rollSavingThrow(
          { ability: "con", target: 12 },
          { configure: true, title: `${actor.name} — Forced march save DC 12` },
          { create: true, data: { flavor: `${actor.name} — Forced march save DC 12` } }
        );
        if (!native) return null;
        const roll = Array.isArray(native) ? native[0] : native?.rolls?.[0] ?? native?.roll ?? native;
        const total = Number(roll?.total ?? native?.total ?? Number.NaN);
        if (!Number.isFinite(total)) throw new Error("The Constitution saving throw did not return a numeric total.");
        const result = { total, succeeded: total >= 12, automatic: false, resolvedBy: game.user.id };
        if (game.user.isGM) {
          const current = await getActiveJourney();
          const pending = current?.currentDay?.pendingForcedMarchRolls?.find(candidate => candidate.id === request.id);
          if (pending) await this.#record(current, pending, result);
        } else game.socket.emit(SOCKET, { type: "forcedMarch.result", requestId: request.id, result });
        return total;
      }}]
    });
    this.#dialogs.set(request.id, dialog);
    await dialog.render({ force: true });
  }

  async #record(journey, request, result) {
    if (!result.succeeded) {
      const actor = await fromUuid(request.actorUuid);
      if (actor) {
        const current = Number(actor.system?.attributes?.exhaustion ?? 0);
        await actor.update({ "system.attributes.exhaustion": current + 1 });
      }
    }
    journey.currentDay.forcedMarchResults ??= [];
    journey.currentDay.forcedMarchResults.push({ actorUuid: request.actorUuid, actorName: request.actorName, dc: 12, ...result, exhaustionChange: result.succeeded ? 0 : 1, resolvedAt: Date.now() });
    journey.currentDay.pendingForcedMarchRolls = journey.currentDay.pendingForcedMarchRolls.filter(candidate => candidate.id !== request.id);
    await saveActiveJourney(journey);
    game.socket.emit(SOCKET, { type: "forcedMarch.resolved", requestId: request.id });
    this.#updated();
  }

  #updated() { this.dispatchEvent(new Event("updated")); }
}

export const forcedMarchRollService = new ForcedMarchRollService();
