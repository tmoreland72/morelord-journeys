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
    campWatches: structuredClone(journey.campDefaults?.watches ?? []),
    campSleepPlan: journey.campDefaults?.sleepPlan ? structuredClone(journey.campDefaults.sleepPlan) : null
  };
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
  const previouslyCompletedDays = journey.log.filter(entry => entry.type === "dayCompleted").length;
  journey.progressSteps = Math.min(journey.routeSnapshot.lengthSteps, previouslyCompletedDays * 3);
  const planned = day.baseProgressSteps + day.progressModifiers.reduce((sum, item) => sum + item.steps, 0);
  const outcome = day.phases.navigation?.outcome ?? "success";
  const delayDays = day.progressModifiers.reduce((sum, item) => sum + Math.max(0, -Number(item.steps ?? 0)), 0);
  journey.routeExtensionDays = Math.max(0, Number(journey.routeExtensionDays ?? 0)) + delayDays;
  const effectiveLengthSteps = journey.routeSnapshot.lengthSteps + journey.routeExtensionDays * 3;
  const remaining = effectiveLengthSteps - journey.progressSteps;
  // A completed travel workflow represents one elapsed route day. Pace, weather,
  // discoveries, and navigation remain recorded outcomes, but they must not make
  // a completed day display as a confusing fraction of a day.
  const applied = Math.min(3, remaining);

  day.appliedProgressSteps = applied;
  journey.progressSteps += applied;
  journey.campDefaults = {
    watches: structuredClone(day.campWatches ?? journey.campDefaults?.watches ?? []),
    sleepPlan: day.campSleepPlan ? structuredClone(day.campSleepPlan) : journey.campDefaults?.sleepPlan ?? null
  };
  appendLog(journey, "dayCompleted", { planned, outcome, applied, total: journey.progressSteps });
  journey.currentDay = null;
  journey.phase = null;
  if (journey.progressSteps >= effectiveLengthSteps) {
    journey.status = JOURNEY_STATUS.ARRIVED;
    appendLog(journey, "journeyArrived");
  }
  return journey;
}
