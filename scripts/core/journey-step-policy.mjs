import { MODULE_ID, TRAVEL_PHASES } from "../domain/constants.mjs";
import { phaseSkipReason } from "../domain/phase-rules.mjs";

export const PHASE_SETTING_KEYS = Object.freeze({
  weather: "phaseWeather", pace: "phasePace", encounters: "phaseEncounters",
  discovery: "phaseDiscovery", navigation: "phaseNavigation", pressOn: "phasePressOn",
  foraging: "phaseForaging", camp: "phaseCamp"
});
export const JOURNEY_STEP_KEYS = Object.freeze({ ...PHASE_SETTING_KEYS, nightEncounters: "enableNightEncounters", sleep: "enableSleepAndShelter" });
export const isPhaseEnabled = (phase, journey) => journey?.steps?.[phase] ?? (!(phase in JOURNEY_STEP_KEYS) || game.settings.get(MODULE_ID, JOURNEY_STEP_KEYS[phase]) !== false);

export function includedJourneyPhases(journey, dayNumber = journey.dayNumber) {
  const entries = journey.log?.filter(entry => entry.type === "phaseRecorded" && entry.dayNumber === dayNumber) ?? [];
  const day = dayNumber === journey.dayNumber ? journey.currentDay : null;
  const pace = day?.pace ?? entries.find(entry => entry.data?.phase === "pace")?.data?.result?.pace;
  return TRAVEL_PHASES.slice(0, -1).filter(phase =>
    !phaseSkipReason({ phase, pace, enabled: isPhaseEnabled(phase, journey) })
    && !day?.phases?.[phase]?.skipped
    && !entries.some(entry => entry.data?.phase === phase && entry.data?.result?.skipped));
}
