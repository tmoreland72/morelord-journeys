import { Dnd5eJourneyAdapter } from "../adapters/dnd5e-journey-adapter.mjs";
import { readyJourney } from "../domain/engine.mjs";
import { createJourney } from "../domain/journey.mjs";
import { createRoute } from "../domain/route.mjs";
import { saveActiveJourney } from "../foundry/settings-repository.mjs";
import { SupplyManifestService } from "../services/supply-manifest-service.mjs";
import { JourneyExpeditionApplication as BaseJourneyApplication } from "./journey-expedition-app.mjs";

const dnd5e = new Dnd5eJourneyAdapter();
const supplies = new SupplyManifestService();
const value = (element, name) => element.querySelector(`[name="${name}"]`)?.value ?? "";
const integer = (element, name, fallback = 0) => {
  const parsed = Number.parseInt(value(element, name), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

function bonus(actor, skillId) {
  const numeric = Number(actor?.system?.skills?.[skillId]?.total ?? actor?.system?.skills?.[skillId]?.mod ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function signed(numeric) {
  return numeric >= 0 ? `+${numeric}` : String(numeric);
}

export class JourneyRoleRefinementApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = {
    actions: { createJourney: this.createJourney }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.availableTravelers = (context.availableTravelers ?? []).map(traveler => {
      const actor = game.actors.get(traveler.id);
      return {
        ...traveler,
        survivalBonus: bonus(actor, "sur"),
        perceptionBonus: bonus(actor, "prc")
      };
    });
    if (context.journey) {
      context.journey.travelers = context.journey.travelers.map(traveler => {
        const actor = game.actors.get(traveler.actorId);
        return {
          ...traveler,
          survivalBonus: bonus(actor, "sur"),
          perceptionBonus: bonus(actor, "prc")
        };
      });
    }
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelector("[name='quartermasterUuid']")?.closest("label")?.remove();
    this.element.querySelector("[name='activeQuartermasterUuid']")?.closest("label")?.remove();
    this.#decorateRoleOptions(context);

    const travelerList = this.element.querySelector(".ml-journeys-traveler-list");
    travelerList?.addEventListener("change", () => queueMicrotask(() => this.#decorateRoleOptions(context)));
  }

  #decorateRoleOptions(context) {
    const travelers = context.hasJourney ? context.journey.travelers : context.availableTravelers;
    const byUuid = new Map(travelers.map(traveler => [traveler.actorUuid ?? traveler.uuid, traveler]));
    for (const name of ["navigatorUuid", "activeNavigatorUuid"]) {
      const select = this.element.querySelector(`[name='${name}']`);
      for (const entry of Array.from(select?.options ?? [])) {
        const traveler = byUuid.get(entry.value);
        if (traveler) entry.textContent = `${traveler.name} (${signed(traveler.survivalBonus)} Survival)`;
      }
    }
    for (const name of ["observerUuid", "activeObserverUuid"]) {
      const select = this.element.querySelector(`[name='${name}']`);
      for (const entry of Array.from(select?.options ?? [])) {
        const traveler = byUuid.get(entry.value);
        if (traveler) entry.textContent = `${traveler.name} (${signed(traveler.perceptionBonus)} Perception)`;
      }
    }
  }

  static async createJourney(event) {
    event.preventDefault();
    try {
      const travelerUuids = Array.from(this.element.querySelectorAll("[name='travelerUuid']:checked"), input => input.value);
      if (!travelerUuids.length) throw new Error("Select at least one traveler.");
      const actors = (await Promise.all(travelerUuids.map(uuid => fromUuid(uuid)))).filter(Boolean);
      const navigatorUuid = value(this.element, "navigatorUuid");
      const observerUuid = value(this.element, "observerUuid");
      if (!navigatorUuid || !observerUuid) throw new Error("Assign a Navigator and Observer.");

      const route = createRoute({
        id: crypto.randomUUID(), name: value(this.element, "routeName"),
        origin: { name: value(this.element, "origin") }, destination: { name: value(this.element, "destination") },
        lengthSteps: integer(this.element, "lengthDays", 1) * 3 + integer(this.element, "lengthThirds", 0),
        danger: integer(this.element, "danger", 1), discoveryDC: integer(this.element, "discoveryDC", 15),
        resourcesDC: integer(this.element, "resourcesDC", 15), navigationDC: integer(this.element, "navigationDC", 10),
        traffic: value(this.element, "routeTraffic") || "ordinary"
      });
      let journey = createJourney({
        id: crypto.randomUUID(), name: value(this.element, "journeyName"), route,
        travelers: actors.map(actor => ({
          ...dnd5e.snapshotTraveler(actor),
          survivalBonus: bonus(actor, "sur"),
          perceptionBonus: bonus(actor, "prc")
        }))
      });
      const partyActor = supplies.findPartyActor(travelerUuids);
      journey.partyActorUuid = partyActor?.uuid ?? null;
      journey.roles = { navigatorUuid, observerUuid };
      journey.supplies = await supplies.build({ travelerUuids, partyActorUuid: journey.partyActorUuid });
      journey = readyJourney(journey);
      await saveActiveJourney(journey);
      ui.notifications.info("Journey created with party roles and supplies.");
      await this.render({ force: true });
    } catch (error) {
      console.error("Morelord Journeys | Unable to create journey.", error);
      ui.notifications.error(error.message);
    }
  }
}
