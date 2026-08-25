import { getPlayerEncounterVisibility } from "../core/journey-settings.mjs";
import { resolveEncounterRoll } from "../domain/encounter-rules.mjs";
import { MODULE_ID } from "../domain/constants.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";

const SOCKET = `module.${MODULE_ID}`;
class EncounterRollService extends EventTarget {
  #started = false;
  #dialogs = new Map();

  start() {
    if (this.#started) return;
    this.#started = true;
    game.socket.on(SOCKET, message => void this.#receive(message));
  }

  async requestPlayers({ modifiers = [] } = {}) {
    if (!game.user.isGM) throw new Error("Only the GM can request encounter checks.");
    const journey = await getActiveJourney();
    const recipients = this.#partyUsers(journey);
    if (!recipients.length) throw new Error("No active player owns a traveler in this journey.");
    // A travel day has one encounter check. Player mode delegates that single
    // d100 check to the first active owner in party order.
    const requests = recipients.slice(0, 1).map(({ user, actor }) => ({
      id: crypto.randomUUID(), journeyId: journey.id, dayNumber: journey.dayNumber,
      userId: user.id, userName: user.name, actorUuid: actor?.uuid ?? user.character?.uuid ?? null,
      actorName: actor?.name ?? user.character?.name ?? user.name,
      die: "1d100", danger: Number(journey.routeSnapshot.danger ?? 0), modifiers, rollMode: getPlayerEncounterVisibility(), requestedAt: Date.now()
    }));
    journey.currentDay.pendingEncounterRolls = requests;
    journey.currentDay.encounterPlayerResults = [];
    await saveActiveJourney(journey);
    for (const request of requests) game.socket.emit(SOCKET, { type: "encounterRoll.request", request });
    console.info(`${MODULE_ID} | Sent encounter checks`, requests.map(request => ({ userId: request.userId, actor: request.actorName })));
    this.#updated();
  }

  async #receive(message) {
    if (message?.type === "encounterRoll.request" && message.request?.userId === game.user.id) {
      ui.notifications.info("Morelord Journeys sent you an encounter check.");
      return this.#open(message.request);
    }
    if (message?.type === "encounterRoll.result" && game.user.isGM) {
      const journey = await getActiveJourney();
      const pending = journey?.currentDay?.pendingEncounterRolls ?? [];
      if (!pending.some(request => request.id === message.requestId)) return;
      journey.currentDay.encounterPlayerResults ??= [];
      journey.currentDay.encounterPlayerResults.push(message.result);
      journey.currentDay.pendingEncounterRolls = pending.filter(request => request.id !== message.requestId);
      const result = resolveEncounterRoll({ raw: message.result.total, danger: message.result.danger, modifiers: message.result.modifiers });
      const actors = (await Promise.all(journey.travelers.map(traveler => fromUuid(traveler.actorUuid)))).filter(Boolean);
      const passives = actors.map(actor => Number(actor.system?.skills?.prc?.passive ?? 10 + Number(actor.system?.skills?.prc?.total ?? 0)));
      const pacePenalty = journey.currentDay?.pace === "fast" ? -5 : 0;
      journey.currentDay.encounterCheck = { ...result, mode: "players", roller: message.result.actorName, highestPassivePerception: (passives.length ? Math.max(...passives) : 0) + pacePenalty, pacePenalty, rolledAt: Date.now() };
      await saveActiveJourney(journey);
      game.socket.emit(SOCKET, { type: "encounterRoll.resolved", requestId: message.requestId });
      this.#updated();
    }
    if (message?.type === "encounterRoll.resolved") {
      const dialog = this.#dialogs.get(message.requestId);
      if (dialog) await dialog.close();
      this.#dialogs.delete(message.requestId);
    }
  }

  async #open(request) {
    this.#dialogs.get(request.id)?.close();
    this.#dialogs.delete(request.id);
    const content = `<div class="ml-journeys encounter-roll-request"><p><strong>${foundry.utils.escapeHTML(request.actorName)}</strong> makes the party's daytime encounter check.</p><p>Roll 1d100. Danger ${request.danger} modifies the result toward or away from major encounters.</p></div>`;
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: "Morelord Journeys — Encounter Check", icon: "fa-solid fa-dice" }, content, modal: false,
      buttons: [{ action: "roll", label: `Roll ${request.die}`, default: true, icon: "fa-solid fa-dice", callback: async () => {
        const roll = await new Roll("1d100").evaluate();
        const flavor = `${request.actorName} — Journey encounter check`;
        await roll.toMessage({ flavor }, { rollMode: request.rollMode ?? "gmroll" });
        const total = Number(roll.total);
        game.socket.emit(SOCKET, { type: "encounterRoll.result", requestId: request.id, result: { requestId: request.id, userId: game.user.id, userName: game.user.name, actorName: request.actorName, die: "1d100", danger: request.danger, modifiers: request.modifiers, total, resolvedAt: Date.now() } });
      }}]
    });
    this.#dialogs.set(request.id, dialog);
    await dialog.render({ force: true });
  }

  #partyUsers(journey) {
    const actors = (journey?.travelers ?? []).map(traveler => game.actors.get(traveler.actorId) ?? game.actors.find(actor => actor.uuid === traveler.actorUuid)).filter(Boolean);
    const recipients = [];
    for (const user of game.users.filter(candidate => candidate.active && !candidate.isGM)) {
      const actor = actors.find(candidate => user.character?.uuid === candidate.uuid || candidate.testUserPermission?.(user, "OWNER"));
      if (actor) recipients.push({ user, actor });
    }
    return recipients;
  }

  #updated() { this.dispatchEvent(new Event("updated")); }
}

export const encounterRollService = new EncounterRollService();
