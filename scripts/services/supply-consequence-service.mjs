import { MODULE_ID } from "../domain/constants.mjs";
import { hungerSaveDC, hungerThreshold } from "../domain/supply-rules.mjs";
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
    if (journey.currentDay?.supplyConsequences) return;
    const foodActors = supply.shortageActorUuids?.food ?? forage.failedActorUuids.slice(0, supply.shortages.food);
    const waterActors = supply.shortageActorUuids?.water ?? journey.travelers.slice(0, supply.shortages.water).map(traveler => traveler.actorUuid);
    for (const actorUuid of waterActors) await addExhaustion(actorUuid, 1);
    const hungerResults = [];
    const requests = [];
    for (const traveler of journey.travelers) {
      const actorUuid = traveler.actorUuid;
      const actor = await fromUuid(actorUuid);
      if (!actor) continue;
      if (!foodActors.includes(actorUuid)) {
        await actor.setFlag(MODULE_ID, "daysWithoutFood", 0);
        hungerResults.push({ actorUuid, actorName: actor.name, daysWithoutFood: 0, ateFullMeal: true, exhaustionChange: 0 });
        continue;
      }
      const daysWithoutFood = Number(actor.getFlag(MODULE_ID, "daysWithoutFood") ?? 0) + 1;
      await actor.setFlag(MODULE_ID, "daysWithoutFood", daysWithoutFood);
      const conModifier = Number(actor.system?.abilities?.con?.mod ?? 0);
      const threshold = hungerThreshold(conModifier);
      const dc = hungerSaveDC(daysWithoutFood, conModifier);
      const saveRequired = dc !== null;
      hungerResults.push({ actorUuid, actorName: actor.name, daysWithoutFood, threshold, ateFullMeal: false, saveRequired, dc, exhaustionChange: 0 });
      if (saveRequired) {
        const user = game.users.find(candidate => candidate.active && !candidate.isGM && (candidate.character?.uuid === actor.uuid || actor.testUserPermission?.(candidate, "OWNER"))) ?? game.user;
        requests.push({ id: crypto.randomUUID(), actorUuid, actorName: actor.name, userId: user.id, dc, daysWithoutFood, threshold });
      }
    }
    journey.currentDay.supplyConsequences = { foodActorUuids: foodActors, waterActorUuids: waterActors, hungerResults, results: [], resolved: requests.length === 0, startedAt: Date.now() };
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
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: "Morelord Journeys — Starvation", icon: "fa-solid fa-heart-pulse" },
      content: `<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong> has no food and must make a DC ${request.dc} Constitution saving throw.</p>`,
      modal: false,
      buttons: [{ action: "roll", label: "Roll Constitution Save", default: true, callback: async () => {
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
        } else game.socket.emit(SOCKET, { type: "supplySave.result", requestId: request.id, result });
        return total;
      }}]
    });
    this.#dialogs.set(request.id, dialog);
    await dialog.render({ force: true });
  }

  async #record(journey, request, result) {
    if (!result.succeeded) await addExhaustion(request.actorUuid, 1);
    journey.currentDay.supplyConsequences.results.push({ actorUuid: request.actorUuid, actorName: request.actorName, dc: request.dc, ...result, exhaustionChange: result.succeeded ? 0 : 1, resolvedAt: Date.now() });
    journey.currentDay.pendingSupplySaves = journey.currentDay.pendingSupplySaves.filter(candidate => candidate.id !== request.id);
    journey.currentDay.supplyConsequences.resolved = journey.currentDay.pendingSupplySaves.length === 0;
    await saveActiveJourney(journey);
    game.socket.emit(SOCKET, { type: "supplySave.resolved", requestId: request.id });
    this.#updated();
  }

  #updated() { this.dispatchEvent(new Event("updated")); }
}

export const supplyConsequenceService = new SupplyConsequenceService();
