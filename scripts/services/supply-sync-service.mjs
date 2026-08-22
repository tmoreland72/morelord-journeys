import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { SupplyManifestService } from "./supply-manifest-service.mjs";

const supplies = new SupplyManifestService();

class SupplySyncService {
  #timer = null;

  start() {
    for (const hook of ["createItem", "updateItem", "deleteItem"]) Hooks.on(hook, item => void this.#queue(item?.parent));
  }

  async #queue(actor) {
    if (!game.user.isGM || !actor) return;
    const journey = await getActiveJourney();
    if (!journey) return;
    const sources = new Set([journey.partyActorUuid, ...journey.travelers.map(traveler => traveler.actorUuid)].filter(Boolean));
    if (!sources.has(actor.uuid)) return;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.#refresh(), 250);
  }

  async #refresh() {
    const journey = await getActiveJourney();
    if (!journey) return;
    journey.supplies = await supplies.build({ travelerUuids: journey.travelers.map(traveler => traveler.actorUuid), partyActorUuid: journey.partyActorUuid });
    await saveActiveJourney(journey);
  }
}

export const supplySyncService = new SupplySyncService();
