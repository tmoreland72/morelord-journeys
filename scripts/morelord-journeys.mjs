import { JourneyForagingApplication as JourneyApplication } from "./apps/journey-foraging-app.mjs";
import { registerNightEncounterRequests } from "./apps/journey-final-app.mjs";
import { registerJourneySettings } from "./core/journey-settings.mjs";
import { MorelordCoreAccessService } from "./core/morelord-core-access-service.mjs";
import { MODULE_ID } from "./domain/constants.mjs";
import * as engine from "./domain/engine.mjs";
import { createJourney, validateJourney } from "./domain/journey.mjs";
import { createRoute, validateRoute } from "./domain/route.mjs";
import { clearActiveJourney, getActiveJourney, registerSettings, saveActiveJourney } from "./foundry/settings-repository.mjs";
import { campPerceptionRollService } from "./services/camp-perception-roll-service.mjs";
import { foragingRollService } from "./services/foraging-roll-service.mjs";
import { forcedMarchRollService } from "./services/forced-march-roll-service.mjs";
import { peacefulRestService } from "./services/peaceful-rest-service.mjs";
import { roleRollService } from "./services/role-roll-service.mjs";
import { supplyConsequenceService } from "./services/supply-consequence-service.mjs";
import { supplySyncService } from "./services/supply-sync-service.mjs";
import { sleepRollService } from "./services/sleep-roll-service.mjs";
import { SupplyManifestService } from "./services/supply-manifest-service.mjs";
import { dayEncounterService } from "./services/day-encounter-service.mjs";
import { startJourneyUndo } from "./services/journey-undo-service.mjs";
import { getJourneyTravelContext, updateJourneyTravelContext } from "./domain/travel-context.mjs";

Hooks.once("init", () => { registerSettings(); registerJourneySettings(); });
Hooks.on("getSceneControlButtons", controls => {
  const tokenTools = controls?.tokens?.tools;
  if (!tokenTools) return;
  tokenTools.morelordJourneys = { name: "morelordJourneys", title: "Morelord Journeys", icon: "fa-solid fa-person-hiking", order: Object.keys(tokenTools).length, button: true, visible: true,
    onChange: () => { const api = globalThis.MorelordJourneys ?? game.modules.get(MODULE_ID)?.api; if (!api?.open) return ui.notifications.warn("Morelord Journeys is still initializing."); api.open(); } };
});
Hooks.once("ready", async () => {
  globalThis.MorelordCore?.telemetry?.windows(MODULE_ID, { "morelord-journeys-dashboard": "dashboard.opened" });
  startJourneyUndo();
  registerNightEncounterRequests();
  roleRollService.start();
  campPerceptionRollService.start();
  foragingRollService.start();
  forcedMarchRollService.start();
  peacefulRestService.start();
  sleepRollService.start();
  dayEncounterService.start();
  supplyConsequenceService.start();
  supplySyncService.start();
  const coreAccess = new MorelordCoreAccessService();
  const supplyManifest = new SupplyManifestService();
  await coreAccess.refresh({ quiet: true });
  let journeyApp = null;
  const open = async () => {
    const journey = await getActiveJourney();
    if (journey?.travelers?.length) {
      journey.supplies = await supplyManifest.build({
        travelerUuids: journey.travelers.map(traveler => traveler.actorUuid),
        partyActorUuid: journey.partyActorUuid
      });
      await saveActiveJourney(journey);
    }
    if (journeyApp?.rendered) {
      await journeyApp.render({ force: true });
      journeyApp.bringToFront();
      return journeyApp;
    }
    journeyApp = new JourneyApplication();
    return journeyApp.render({ force: true });
  };
  const travel = Object.freeze({
    getContext: async () => {
      const journey = await getActiveJourney();
      const locations = game.modules.get("morelord-core")?.api?.locations
        ?? globalThis.MorelordCore?.locations;
      return journey
        ? getJourneyTravelContext(journey, { locationResolver: id => locations?.get?.(id) ?? null })
        : null;
    },
    updateContext: async ({ locationId = null, activityHours = 2, temporaryCapabilities = [] } = {}) => {
      if (!game.user.isGM) throw new Error("Only a GM may update Journey travel context.");
      const existing = await getActiveJourney();
      if (!existing) throw new Error("No active Journey exists.");
      const journey = updateJourneyTravelContext(existing, { locationId, activityHours, temporaryCapabilities });
      await saveActiveJourney(journey);
      Hooks.callAll("morelordJourneys.contextChanged", await travel.getContext());
      return travel.getContext();
    }
  });
  const api = Object.freeze({ open, createJourney, createRoute, validateJourney, validateRoute, engine: Object.freeze({ ...engine }), repository: Object.freeze({ clearActiveJourney, getActiveJourney, saveActiveJourney }), travel, applications: Object.freeze({ JourneyApplication }), coreAccess, roleRolls: roleRollService, campPerceptionRolls: campPerceptionRollService, foragingRolls: foragingRollService, forcedMarchRolls: forcedMarchRollService, supplyConsequences: supplyConsequenceService, getAccess: () => coreAccess.snapshot(), refreshEntitlements: options => coreAccess.refresh(options) });
  game.modules.get(MODULE_ID).api = api;
  globalThis.MorelordJourneys = api;
  console.info(`${MODULE_ID} | Ready for Foundry v14 · ${coreAccess.snapshot().tier}`);
});
