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
    phases: {}
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
  const planned = day.baseProgressSteps + day.progressModifiers.reduce((sum, item) => sum + item.steps, 0);
  const outcome = day.phases.navigation?.outcome ?? "success";
  const navigated = outcome === "success" ? planned : outcome === "reversed" ? -planned : 0;
  const remaining = journey.routeSnapshot.lengthSteps - journey.progressSteps;
  const applied = Math.max(-journey.progressSteps, Math.min(navigated, remaining));

  day.appliedProgressSteps = applied;
  journey.progressSteps += applied;
  appendLog(journey, "dayCompleted", { planned, outcome, applied, total: journey.progressSteps });
  journey.currentDay = null;
  journey.phase = null;
  if (journey.progressSteps >= journey.routeSnapshot.lengthSteps) {
    journey.status = JOURNEY_STATUS.ARRIVED;
    appendLog(journey, "journeyArrived");
  }
  return journey;
}
