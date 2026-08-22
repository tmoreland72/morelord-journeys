import { MODULE_ID } from "../domain/constants.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { SupplyManifestService } from "./supply-manifest-service.mjs";

const SOCKET = `module.${MODULE_ID}`;
const supplies = new SupplyManifestService();

class ForagingRollService extends EventTarget {
  #started = false;
  #dialogs = new Map();

  start() {
    if (this.#started) return;
    this.#started = true;
    game.socket.on(SOCKET, message => void this.#receive(message));
  }

  async requestParty() {
    if (!game.user.isGM) throw new Error("Only the GM can request party foraging checks.");
    const journey = await getActiveJourney();
    if (journey?.phase !== "foraging") throw new Error("The journey is not in the Foraging phase.");
    const requests = [];
    for (const traveler of journey.travelers) {
      const actor = game.actors.get(traveler.actorId) ?? game.actors.find(candidate => candidate.uuid === traveler.actorUuid);
      if (!actor) continue;
      const user = game.users.find(candidate => candidate.active && !candidate.isGM && (candidate.character?.uuid === actor.uuid || actor.testUserPermission?.(candidate, "OWNER"))) ?? game.user;
      requests.push({
        id: crypto.randomUUID(), journeyId: journey.id, dayNumber: journey.dayNumber,
        userId: user.id, actorUuid: actor.uuid, actorName: actor.name,
        dc: journey.routeSnapshot.resourcesDC, requestedAt: Date.now()
      });
    }
    if (!requests.length) throw new Error("No active player owns a traveler in this journey.");
    journey.currentDay.pendingForagingRolls = requests;
    journey.currentDay.foragingResults = [];
    await saveActiveJourney(journey);
    for (const request of requests) {
      if (request.userId === game.user.id) await this.#open(request);
      else game.socket.emit(SOCKET, { type: "foragingRoll.request", request });
    }
    this.#updated();
  }

  async autoResolve(requestId, succeeded) {
    if (!game.user.isGM) throw new Error("Only the GM can override a foraging check.");
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingForagingRolls?.find(candidate => candidate.id === requestId);
    if (!request) throw new Error("That foraging request is no longer pending.");
    await this.#record(journey, request, { total: null, succeeded, automatic: true, resolvedBy: game.user.id });
  }

  async #receive(message) {
    if (message?.type === "foragingRoll.request" && message.request?.userId === game.user.id) return this.#open(message.request);
    if (message?.type === "foragingRoll.result" && game.user.isGM) {
      const journey = await getActiveJourney();
      const request = journey?.currentDay?.pendingForagingRolls?.find(candidate => candidate.id === message.requestId);
      if (request) await this.#record(journey, request, message.result);
    }
    if (message?.type === "foragingRoll.resolved") {
      const dialog = this.#dialogs.get(message.requestId);
      if (dialog) await dialog.close();
      this.#dialogs.delete(message.requestId);
    }
  }

  async #open(request) {
    const actor = await fromUuid(request.actorUuid);
    if (!actor) return;
    ui.notifications.info(`${request.actorName} has a pending foraging check.`);
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: "Morelord Journeys — Forage", icon: "fa-solid fa-basket-shopping" },
      content: `<p><strong>${foundry.utils.escapeHTML(request.actorName)}</strong> must make a Survival check against Resources DC ${request.dc}.</p>`,
      modal: false,
      buttons: [{ action: "roll", label: "Roll Survival", icon: "fa-solid fa-dice-d20", default: true, callback: async () => {
        const native = await actor.rollSkill(
          { skill: "sur", target: request.dc },
          { configure: true, title: `${request.actorName} — Foraging DC ${request.dc}` },
          { create: true, data: { flavor: `Morelord Journeys foraging check — DC ${request.dc}` } }
        );
        if (!native) return;
        const roll = Array.isArray(native) ? native[0] : native?.rolls?.[0] ?? native?.roll ?? native;
        const total = Number(roll?.total ?? native?.total);
        game.socket.emit(SOCKET, { type: "foragingRoll.result", requestId: request.id, result: { total, succeeded: total >= request.dc, automatic: false, resolvedBy: game.user.id } });
      }}]
    });
    this.#dialogs.set(request.id, dialog);
    await dialog.render({ force: true });
  }

  async #record(journey, request, result) {
    journey.currentDay.foragingResults ??= [];
    journey.currentDay.foragingResults = journey.currentDay.foragingResults.filter(candidate => candidate.actorUuid !== request.actorUuid);
    journey.currentDay.foragingResults.push({ requestId: request.id, actorUuid: request.actorUuid, actorName: request.actorName, dc: request.dc, ...result, resolvedAt: Date.now() });
    journey.currentDay.pendingForagingRolls = (journey.currentDay.pendingForagingRolls ?? []).filter(candidate => candidate.id !== request.id);
    const successes = journey.currentDay.foragingResults.filter(candidate => candidate.succeeded);
    const partySize = journey.travelers.length;
    journey.currentDay.foragingResolution = {
      successfulActorUuids: successes.map(candidate => candidate.actorUuid),
      failedActorUuids: journey.travelers.filter(traveler => !successes.some(candidate => candidate.actorUuid === traveler.actorUuid)).map(traveler => traveler.actorUuid),
      foodRequired: partySize - successes.length,
      waterRequired: successes.length ? 0 : partySize,
      resourcesDC: journey.routeSnapshot.resourcesDC,
      resolvedAt: Date.now()
    };
    if (journey.currentDay.pendingForagingRolls.length === 0) {
      journey.supplies = await supplies.build({
        travelerUuids: journey.travelers.map(traveler => traveler.actorUuid),
        partyActorUuid: journey.partyActorUuid
      });
      journey.currentDay.supplyResolution = null;
    }
    await saveActiveJourney(journey);
    game.socket.emit(SOCKET, { type: "foragingRoll.resolved", requestId: request.id });
    this.#updated();
  }

  #updated() { this.dispatchEvent(new Event("updated")); }
}

export const foragingRollService = new ForagingRollService();
