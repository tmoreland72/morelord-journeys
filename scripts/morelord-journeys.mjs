import { JourneyForagingApplication as JourneyApplication } from "./apps/journey-foraging-app.mjs";
import { registerJourneySettings } from "./core/journey-settings.mjs";
import { MorelordCoreAccessService } from "./core/morelord-core-access-service.mjs";
import { MODULE_ID } from "./domain/constants.mjs";
import * as engine from "./domain/engine.mjs";
import { createJourney, validateJourney } from "./domain/journey.mjs";
import { createRoute, validateRoute } from "./domain/route.mjs";
import { clearActiveJourney, getActiveJourney, registerSettings, saveActiveJourney } from "./foundry/settings-repository.mjs";
import { encounterRollService } from "./services/encounter-roll-service.mjs";
import { foragingRollService } from "./services/foraging-roll-service.mjs";
import { roleRollService } from "./services/role-roll-service.mjs";
import { supplyConsequenceService } from "./services/supply-consequence-service.mjs";
import { supplySyncService } from "./services/supply-sync-service.mjs";

Hooks.once("init", () => { registerSettings(); registerJourneySettings(); });
Hooks.on("getSceneControlButtons", controls => {
  const tokenTools = controls?.tokens?.tools;
  if (!tokenTools) return;
  tokenTools.morelordJourneys = { name: "morelordJourneys", title: "Morelord Journeys", icon: "fa-solid fa-person-hiking", order: Object.keys(tokenTools).length, button: true, visible: true,
    onChange: () => { const api = globalThis.MorelordJourneys ?? game.modules.get(MODULE_ID)?.api; if (!api?.open) return ui.notifications.warn("Morelord Journeys is still initializing."); api.open(); } };
});
Hooks.once("ready", async () => {
  roleRollService.start();
  encounterRollService.start();
  foragingRollService.start();
  supplyConsequenceService.start();
  supplySyncService.start();
  const coreAccess = new MorelordCoreAccessService();
  await coreAccess.refresh({ quiet: true });
  let journeyApp = null;
  const open = async () => { if (journeyApp?.rendered) { journeyApp.bringToFront(); return journeyApp; } journeyApp = new JourneyApplication(); return journeyApp.render({ force: true }); };
  const api = Object.freeze({ open, createJourney, createRoute, validateJourney, validateRoute, engine: Object.freeze({ ...engine }), repository: Object.freeze({ clearActiveJourney, getActiveJourney, saveActiveJourney }), applications: Object.freeze({ JourneyApplication }), coreAccess, roleRolls: roleRollService, encounterRolls: encounterRollService, foragingRolls: foragingRollService, supplyConsequences: supplyConsequenceService, getAccess: () => coreAccess.snapshot(), refreshEntitlements: options => coreAccess.refresh(options) });
  game.modules.get(MODULE_ID).api = api;
  globalThis.MorelordJourneys = api;
  console.info(`${MODULE_ID} | Ready for Foundry v14 · ${coreAccess.snapshot().tier}`);
});
