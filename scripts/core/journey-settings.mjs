import { JourneySettingsApplication } from "../apps/journey-settings-app.mjs";
import { MODULE_ID } from "../domain/constants.mjs";

export const SUPPRESS_SLEEP_DEPRIVATION_EXHAUSTION_SETTING = "suppressSleepDeprivationExhaustion";
export const NIGHT_ENCOUNTERS_SETTING = "enableNightEncounters";
export const SLEEP_AND_SHELTER_SETTING = "enableSleepAndShelter";
export const DC_CONFIGURATION_SETTING = "dcConfiguration";
export const DEFAULT_DC_CONFIGURATION = Object.freeze({
  discovery: Object.freeze([5, 10, 15, 20, 25]),
  navigation: Object.freeze([5, 10, 15, 20, 25, 30]),
  foraging: Object.freeze([5, 10, 15, 20, 25, 30]),
  pressOn: 12,
  hungerBase: 10,
  hungerIncrease: 5,
  sleepBase: 10,
  sleepDeprivationBase: 10,
  sleepDeprivationIncrease: 5
});
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
  game.settings.register(MODULE_ID, DC_CONFIGURATION_SETTING, {
    name: "Journey Difficulty Classes",
    hint: "World-level DCs used by Journeys. Route preset changes apply to newly created journeys.",
    scope: "world", config: false, type: Object, default: DEFAULT_DC_CONFIGURATION, restricted: true
  });
}

export const isPhaseEnabled = phase => phase === "sleep"
  ? sleepAndShelterEnabled()
  : !(phase in PHASE_SETTING_KEYS) || game.settings.get(MODULE_ID, PHASE_SETTING_KEYS[phase]) !== false;
export const suppressSleepDeprivationExhaustion = () => Boolean(game.settings.get(MODULE_ID, SUPPRESS_SLEEP_DEPRIVATION_EXHAUSTION_SETTING));
export const nightEncountersEnabled = () => game.settings.get(MODULE_ID, NIGHT_ENCOUNTERS_SETTING) !== false;
export const sleepAndShelterEnabled = () => game.settings.get(MODULE_ID, SLEEP_AND_SHELTER_SETTING) !== false;
export function getDCConfiguration() {
  const saved = game.settings.get(MODULE_ID, DC_CONFIGURATION_SETTING) ?? {};
  return {
    ...DEFAULT_DC_CONFIGURATION,
    ...saved,
    discovery: DEFAULT_DC_CONFIGURATION.discovery.map((value, index) => Number(saved.discovery?.[index] ?? value)),
    navigation: DEFAULT_DC_CONFIGURATION.navigation.map((value, index) => Number(saved.navigation?.[index] ?? value)),
    foraging: DEFAULT_DC_CONFIGURATION.foraging.map((value, index) => Number(saved.foraging?.[index] ?? value))
  };
}
