import { JourneySettingsApplication } from "../apps/journey-settings-app.mjs";
import { MODULE_ID } from "../domain/constants.mjs";

export const ENCOUNTER_DIE_SETTING = "encounterDie";
export const ENCOUNTER_ROLL_MODE_SETTING = "encounterRollMode";
export const PLAYER_ENCOUNTER_VISIBILITY_SETTING = "playerEncounterVisibility";
export const SUPPRESS_SLEEP_DEPRIVATION_EXHAUSTION_SETTING = "suppressSleepDeprivationExhaustion";
export const NIGHT_ENCOUNTERS_SETTING = "enableNightEncounters";
export const SLEEP_AND_SHELTER_SETTING = "enableSleepAndShelter";
export const PHASE_SETTING_KEYS = Object.freeze({
  weather: "phaseWeather", pace: "phasePace", encounters: "phaseEncounters",
  discovery: "phaseDiscovery", navigation: "phaseNavigation", pressOn: "phasePressOn",
  foraging: "phaseForaging", camp: "phaseCamp"
});

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
    name: "Encounter Check Method", hint: "The GM or one active party owner rolls the day's d100 encounter check.",
    scope: "world", config: false, type: String, choices: { gm: "GM rolls d100", players: "Player rolls d100" }, default: "gm", restricted: true
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
  for (const [phase, key] of Object.entries(PHASE_SETTING_KEYS)) {
    game.settings.register(MODULE_ID, key, {
      name: `Enable ${phase}`, hint: `Include the ${phase} phase in travel days.`,
      scope: "world", config: false, type: Boolean, default: true, restricted: true
    });
  }
  game.settings.register(MODULE_ID, SUPPRESS_SLEEP_DEPRIVATION_EXHAUSTION_SETTING, {
    name: "Do not add Exhaustion for lack of sleep",
    hint: "Characters who miss a Long Rest still receive no Long Rest benefits, but Journeys skips Xanathar-style sleep-deprivation Exhaustion saves.",
    scope: "world", config: false, type: Boolean, default: false, restricted: true
  });
  game.settings.register(MODULE_ID, NIGHT_ENCOUNTERS_SETTING, {
    name: "Enable Night Encounters", hint: "Include the single nightly d100 encounter check during Camp.",
    scope: "world", config: false, type: Boolean, default: true, restricted: true
  });
  game.settings.register(MODULE_ID, SLEEP_AND_SHELTER_SETTING, {
    name: "Enable Sleep and Shelter", hint: "Resolve shelter, sleep, Long Rest, and sleep-deprivation outcomes during Camp.",
    scope: "world", config: false, type: Boolean, default: true, restricted: true
  });
}

export const getEncounterDie = () => game.settings.get(MODULE_ID, ENCOUNTER_DIE_SETTING) ?? "d8";
export const getEncounterRollMode = () => game.settings.get(MODULE_ID, ENCOUNTER_ROLL_MODE_SETTING) ?? "gm";
export const getPlayerEncounterVisibility = () => game.settings.get(MODULE_ID, PLAYER_ENCOUNTER_VISIBILITY_SETTING) ?? "gmroll";
export const isPhaseEnabled = phase => phase === "sleep"
  ? sleepAndShelterEnabled()
  : !(phase in PHASE_SETTING_KEYS) || game.settings.get(MODULE_ID, PHASE_SETTING_KEYS[phase]) !== false;
export const suppressSleepDeprivationExhaustion = () => Boolean(game.settings.get(MODULE_ID, SUPPRESS_SLEEP_DEPRIVATION_EXHAUSTION_SETTING));
export const nightEncountersEnabled = () => game.settings.get(MODULE_ID, NIGHT_ENCOUNTERS_SETTING) !== false;
export const sleepAndShelterEnabled = () => game.settings.get(MODULE_ID, SLEEP_AND_SHELTER_SETTING) !== false;
