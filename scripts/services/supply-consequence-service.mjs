import { MODULE_ID } from "../domain/constants.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";

const SOCKET = `module.${MODULE_ID}`;

async function addExhaustion(actorUuid, amount = 1) {
  const actor = await fromUuid(actorUuid);
  if (!actor) return;
  const current = Number(actor.system?.attributes?.exhaustion ?? 0);
  await actor.update({ "system.attributes.exhaustion": Math.max(0, current + amount) });
}

class SupplyConsequenceService extends EventTarget {
  #started = false;
  #dialogs = new Map();

  start() {
    if (this.#started) return;
    this.#started = true;
    game.socket.on(SOCKET, message => void this.#receive(message));
  }

  async begin() {
    if (!game.user.isGM) throw new Error("Only the GM can resolve supply shortages.");
    const journey = await getActiveJourney();
    const supply = journey?.currentDay?.supplyResolution;
    const forage = journey?.currentDay?.foragingResolution;
    if (!supply || !forage) throw new Error("Resolve daily supplies first.");
    const foodActors = supply.shortageActorUuids?.food ?? forage.failedActorUuids.slice(0, supply.shortages.food);
    const waterActors = supply.shortageActorUuids?.water ?? journey.travelers.slice(0, supply.shortages.water).map(traveler => traveler.actorUuid);
    for (const actorUuid of waterActors) await addExhaustion(actorUuid, 1);
    const requests = [];
    for (const actorUuid of foodActors) {
      const actor = await fromUuid(actorUuid);
      if (!actor) continue;
      const user = game.users.find(candidate => candidate.active && !candidate.isGM && (candidate.character?.uuid === actor.uuid || actor.testUserPermission?.(candidate, "OWNER"))) ?? game.user;
      requests.push({ id: crypto.randomUUID(), actorUuid, actorName: actor.name, userId: user.id, dc: 20, reason: "starvation" });
    }
    journey.currentDay.supplyConsequences = { foodActorUuids: foodActors, waterActorUuids: waterActors, results: [], resolved: requests.length === 0, startedAt: Date.now() };
    journey.currentDay.pendingSupplySaves = requests;
    await saveActiveJourney(journey);
    for (const request of requests) {
      if (request.userId === game.user.id) await this.#open(request);
      else game.socket.emit(SOCKET, { type: "supplySave.request", request });
    }
    this.#updated();
  }

  async autoResolve(requestId, succeeded) {
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
      if (request) await this.#record(journey, request, message.result);
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
    const modifier = Number(actor.system?.abilities?.con?.save?.value ?? actor.system?.abilities?.con?.save ?? 0);
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: "Morelord Journeys — Starvation", icon: "fa-solid fa-heart-pulse" },
      content: `<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong> has no food and must make a DC ${request.dc} Constitution saving throw.</p>`,
      modal: false,
      buttons: [{ action: "roll", label: "Roll Constitution Save", default: true, callback: async () => {
        const roll = await new Roll("1d20 + @modifier", { modifier }).evaluate();
        await roll.toMessage({ flavor: `${actor.name} — Starvation save DC ${request.dc}` });
        game.socket.emit(SOCKET, { type: "supplySave.result", requestId: request.id, result: { total: roll.total, succeeded: roll.total >= request.dc, automatic: false } });
      }}]
    });
    this.#dialogs.set(request.id, dialog);
    await dialog.render({ force: true });
  }

  async #record(journey, request, result) {
    if (!result.succeeded) await addExhaustion(request.actorUuid, 1);
    journey.currentDay.supplyConsequences.results.push({ actorUuid: request.actorUuid, actorName: request.actorName, ...result, resolvedAt: Date.now() });
    journey.currentDay.pendingSupplySaves = journey.currentDay.pendingSupplySaves.filter(candidate => candidate.id !== request.id);
    journey.currentDay.supplyConsequences.resolved = journey.currentDay.pendingSupplySaves.length === 0;
    await saveActiveJourney(journey);
    game.socket.emit(SOCKET, { type: "supplySave.resolved", requestId: request.id });
    this.#updated();
  }

  #updated() { this.dispatchEvent(new Event("updated")); }
}

export const supplyConsequenceService = new SupplyConsequenceService();
