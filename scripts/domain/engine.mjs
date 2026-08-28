import { JOURNEY_STATUS, PACE_STEPS, TRAVEL_PHASES } from "./constants.mjs";
import { validateJourney } from "./journey.mjs";
import { JourneyValidationError } from "./validation.mjs";

const clone = journey => structuredClone(validateJourney(journey));

function appendLog(journey, type, data = {}) {
  journey.log.push({
    id: globalThis.crypto.randomUUID(),
    type,
    dayNumber: journey.dayNumber,
    phase: journey.phase,
    timestamp: Date.now(),
    data: structuredClone(data)
  });
}

export function readyJourney(source) {
  const journey = clone(source);
  if (journey.status !== JOURNEY_STATUS.PLANNING) {
    throw new JourneyValidationError("Only a planning journey can be made ready");
  }
  journey.status = JOURNEY_STATUS.READY;
  appendLog(journey, "journeyReady");
  return journey;
}

export function beginTravelDay(source) {
  const journey = clone(source);
  if (![JOURNEY_STATUS.READY, JOURNEY_STATUS.ACTIVE].includes(journey.status)) {
    throw new JourneyValidationError("Journey cannot begin a travel day in its current status");
  }
  if (journey.currentDay !== null) throw new JourneyValidationError("Complete the current travel day first");

  journey.status = JOURNEY_STATUS.ACTIVE;
  journey.dayNumber += 1;
  journey.phase = TRAVEL_PHASES[0];
  journey.currentDay = {
    number: journey.dayNumber,
    pace: null,
    baseProgressSteps: null,
    progressModifiers: [],
    appliedProgressSteps: 0,
    phases: {},
    campWatches: structuredClone(journey.campDefaults?.watches ?? []).map(watch => ({ ...watch, encounterRoll: null })),
    campSleepPlan: journey.campDefaults?.sleepPlan ? structuredClone(journey.campDefaults.sleepPlan) : null
  };
  for (const entry of journey.currentDay.campSleepPlan?.entries ?? []) {
    delete entry.sleepHours;
    delete entry.interruptionHours;
    delete entry.interruptionMinutes;
  }
  appendLog(journey, "dayStarted");
  return journey;
}

export function recordPhase(source, phase, result = {}) {
  const journey = clone(source);
  if (journey.status !== JOURNEY_STATUS.ACTIVE || journey.phase !== phase) {
    throw new JourneyValidationError(`Expected phase ${journey.phase ?? "none"}, received ${phase}`);
  }
  if (phase === "pace") {
    if (!(result.pace in PACE_STEPS)) throw new JourneyValidationError(`Unknown pace: ${result.pace}`);
    journey.currentDay.pace = result.pace;
    journey.currentDay.baseProgressSteps = PACE_STEPS[result.pace];
  }
  journey.currentDay.phases[phase] = structuredClone(result);
  appendLog(journey, "phaseRecorded", { phase, result });
  journey.phase = TRAVEL_PHASES[TRAVEL_PHASES.indexOf(phase) + 1] ?? null;
  return journey;
}

export function addProgressModifier(source, { id, label, steps }) {
  const journey = clone(source);
  if (journey.status !== JOURNEY_STATUS.ACTIVE || !journey.currentDay) {
    throw new JourneyValidationError("Progress modifiers require an active travel day");
  }
  if (!Number.isInteger(steps)) throw new JourneyValidationError("Modifier steps must be an integer");
  journey.currentDay.progressModifiers.push({ id, label, steps });
  appendLog(journey, "progressModifierAdded", { id, label, steps });
  return journey;
}

export function completeTravelDay(source) {
  const journey = clone(source);
  if (journey.phase !== "dayComplete" || !journey.currentDay) {
    throw new JourneyValidationError("All travel-day phases must be resolved before completion");
  }
  const day = journey.currentDay;
  const planned = day.baseProgressSteps + day.progressModifiers.reduce((sum, item) => sum + item.steps, 0);
  const outcome = day.phases.navigation?.outcome ?? "success";
  const gainedDespiteLostNavigation = day.progressModifiers.filter(item => item.steps > 0).reduce((sum, item) => sum + item.steps, 0);
  const navigated = outcome === "lost" ? gainedDespiteLostNavigation : outcome === "reversed" ? -3 : outcome === "shortcut" ? planned + 1 : planned;
  const applied = Math.min(journey.remainingSteps, navigated);

  day.appliedProgressSteps = applied;
  journey.remainingSteps = Math.max(0, journey.remainingSteps - applied);
  journey.progressSteps = Math.max(0, journey.routeSnapshot.lengthSteps - journey.remainingSteps);
  journey.campDefaults = {
    watches: structuredClone(day.campWatches ?? journey.campDefaults?.watches ?? []),
    sleepPlan: day.campSleepPlan ? structuredClone(day.campSleepPlan) : journey.campDefaults?.sleepPlan ?? null
  };
  appendLog(journey, "dayCompleted", { planned, outcome, applied, total: journey.progressSteps });
  journey.currentDay = null;
  journey.phase = null;
  if (journey.remainingSteps <= 0) {
    journey.status = JOURNEY_STATUS.ARRIVED;
    appendLog(journey, "journeyArrived");
  }
  return journey;
}
