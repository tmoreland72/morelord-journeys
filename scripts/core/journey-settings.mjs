import { JourneySettingsApplication } from "../apps/journey-settings-app.mjs";
import { MODULE_ID } from "../domain/constants.mjs";

export const SUPPRESS_SLEEP_DEPRIVATION_EXHAUSTION_SETTING = "suppressSleepDeprivationExhaustion";
export const NIGHT_ENCOUNTERS_SETTING = "enableNightEncounters";
export const SLEEP_AND_SHELTER_SETTING = "enableSleepAndShelter";
export const SKIP_DICE_ANIMATION_SETTING = "skipDiceAnimation";
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
export const JOURNEY_PLANNER_DEFAULTS_SETTING = "journeyPlannerDefaults";
export const PHASE_SETTING_KEYS = Object.freeze({
  weather: "phaseWeather", pace: "phasePace", encounters: "phaseEncounters",
  discovery: "phaseDiscovery", navigation: "phaseNavigation", pressOn: "phasePressOn",
  foraging: "phaseForaging", camp: "phaseCamp"
});

export function registerJourneySettings() {
  game.settings.register(MODULE_ID, JOURNEY_PLANNER_DEFAULTS_SETTING, {
    name: "Journey creation defaults", scope: "world", config: false,
    type: Object, default: {}, restricted: true
  });
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
  game.settings.register(MODULE_ID, SKIP_DICE_ANIMATION_SETTING, {
    name: "Skip dice roll animation",
    hint: "Record GM journey rolls without displaying their dice animation or chat roll card.",
    scope: "world", config: false, type: Boolean, default: false, restricted: true
  });
  game.settings.register(MODULE_ID, DC_CONFIGURATION_SETTING, {
    name: "Journey Difficulty Classes",
    hint: "World-level DCs used by Journeys. Route preset changes apply to newly created journeys.",
    scope: "world", config: false, type: Object, default: DEFAULT_DC_CONFIGURATION, restricted: true
  });
}

export const JOURNEY_STEP_KEYS = Object.freeze({ ...PHASE_SETTING_KEYS, nightEncounters: NIGHT_ENCOUNTERS_SETTING, sleep: SLEEP_AND_SHELTER_SETTING });
export function getJourneyStepDefaults() {
  const fields = game.settings.get(MODULE_ID, JOURNEY_PLANNER_DEFAULTS_SETTING)?.fields ?? {};
  return Object.fromEntries(Object.entries(JOURNEY_STEP_KEYS).map(([step, key]) => [step, fields[`step-${step}`] ?? game.settings.get(MODULE_ID, key) !== false]));
}
export function readJourneySteps(element) {
  const defaults = getJourneyStepDefaults();
  return Object.fromEntries(Object.keys(JOURNEY_STEP_KEYS).map(step => [step, element.querySelector(`[name="step-${step}"]`)?.checked ?? defaults[step]]));
}
export const isPhaseEnabled = (phase, journey) => journey?.steps?.[phase] ?? (!(phase in JOURNEY_STEP_KEYS) || game.settings.get(MODULE_ID, JOURNEY_STEP_KEYS[phase]) !== false);
export const suppressSleepDeprivationExhaustion = () => Boolean(game.settings.get(MODULE_ID, SUPPRESS_SLEEP_DEPRIVATION_EXHAUSTION_SETTING));
export const nightEncountersEnabled = journey => isPhaseEnabled("nightEncounters", journey);
export const sleepAndShelterEnabled = journey => isPhaseEnabled("sleep", journey);
export const skipDiceAnimation = () => Boolean(game.settings.get(MODULE_ID, SKIP_DICE_ANIMATION_SETTING));
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
