import { JourneySettingsApplication } from "../apps/journey-settings-app.mjs";
import { MODULE_ID } from "../domain/constants.mjs";

export const ENCOUNTER_DIE_SETTING = "encounterDie";
export const ENCOUNTER_ROLL_MODE_SETTING = "encounterRollMode";
export const PLAYER_ENCOUNTER_VISIBILITY_SETTING = "playerEncounterVisibility";

export function registerJourneySettings() {
  game.settings.registerMenu(MODULE_ID, "configure", {
    name: "Journeys Settings", label: "Configure Journeys",
    hint: "Manage Morelord Core access, subscription status, and Journeys configuration.",
    icon: "fa-solid fa-person-hiking", type: JourneySettingsApplication, restricted: true
  });
  game.settings.register(MODULE_ID, ENCOUNTER_DIE_SETTING, {
    name: "Encounter Check Die", hint: "The die used for encounter checks. A 1 creates a complication and the maximum result creates a boon.",
    scope: "world", config: false, type: String,
    choices: { d4: "d4 — Frequent events", d6: "d6", d8: "d8 — Default", d10: "d10", d12: "d12", d20: "d20 — Rare events" }, default: "d8", restricted: true
  });
  game.settings.register(MODULE_ID, ENCOUNTER_ROLL_MODE_SETTING, {
    name: "Encounter Check Method", hint: "The GM can roll once per Danger level, or each active party player can roll one encounter die.",
    scope: "world", config: false, type: String, choices: { gm: "GM rolls by Danger", players: "Each player rolls one die" }, default: "gm", restricted: true
  });
  game.settings.register(MODULE_ID, PLAYER_ENCOUNTER_VISIBILITY_SETTING, {
    name: "Player Encounter Roll Visibility",
    hint: "Use Foundry's standard visibility for encounter checks rolled by players.",
    scope: "world", config: false, type: String,
    choices: {
      publicroll: "Public Roll — visible to everyone",
      gmroll: "Private GM Roll — visible to the roller and GM",
      blindroll: "Blind GM Roll — visible only to the GM"
    },
    default: "gmroll", restricted: true
  });
}

export const getEncounterDie = () => game.settings.get(MODULE_ID, ENCOUNTER_DIE_SETTING) ?? "d8";
export const getEncounterRollMode = () => game.settings.get(MODULE_ID, ENCOUNTER_ROLL_MODE_SETTING) ?? "gm";
export const getPlayerEncounterVisibility = () => game.settings.get(MODULE_ID, PLAYER_ENCOUNTER_VISIBILITY_SETTING) ?? "gmroll";
