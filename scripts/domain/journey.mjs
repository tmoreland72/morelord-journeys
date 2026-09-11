import { JOURNEY_STATUS, SCHEMA_VERSION, TRAVEL_PHASES } from "./constants.mjs";
import { validateRoute } from "./route.mjs";
import { JourneyValidationError, requireString } from "./validation.mjs";

export function createJourney({ id, name, route, travelers = [], steps = {}, rulesProfileId = "core", activityHoursPerDay = 2, currentLocationId = null, temporaryCapabilities = [] }) {
  const issues = [];
  requireString(id, "id", issues);
  requireString(name, "name", issues);
  validateRoute(route);
  if (issues.length) throw new JourneyValidationError("Journey is invalid", issues);

  return {
    id,
    name,
    routeSnapshot: structuredClone(route),
    status: JOURNEY_STATUS.PLANNING,
    phase: null,
    progressSteps: 0,
    remainingSteps: route.lengthSteps,
    dayNumber: 0,
    travelers: structuredClone(travelers),
    steps: structuredClone(steps),
    roles: {},
    supplies: { food: 0, water: 0 },
    currentDay: null,
    activityHoursPerDay: Math.max(0, Math.min(24, Number(activityHoursPerDay) || 0)),
    currentLocationId: currentLocationId ? String(currentLocationId) : null,
    temporaryCapabilities: structuredClone(temporaryCapabilities),
    campDefaults: { watches: [], sleepPlan: null },
    log: [],
    rulesProfileId,
    schemaVersion: SCHEMA_VERSION
  };
}

export function validateJourney(journey) {
  const issues = [];
  requireString(journey?.id, "id", issues);
  requireString(journey?.name, "name", issues);
  if (!Object.values(JOURNEY_STATUS).includes(journey?.status)) issues.push("status is not recognized");
  if (journey?.phase !== null && !TRAVEL_PHASES.includes(journey.phase)) issues.push("phase is not recognized");
  if (!Number.isInteger(journey?.progressSteps) || journey.progressSteps < 0) {
    issues.push("progressSteps must be a non-negative integer");
  }
  if (!Number.isInteger(journey?.remainingSteps) || journey.remainingSteps < 0) {
    issues.push("remainingSteps must be a non-negative integer");
  }
  if (journey?.roles?.navigatorUuid && journey.roles.navigatorUuid === journey.roles.observerUuid) {
    issues.push("Navigator and Observer must be different characters");
  }
  try {
    validateRoute(journey?.routeSnapshot);
  } catch (error) {
    issues.push(...(error.issues ?? [error.message]));
  }
  if (issues.length) throw new JourneyValidationError("Journey is invalid", issues);
  return journey;
}
