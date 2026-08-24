import { JOURNEY_STATUS, SCHEMA_VERSION, TRAVEL_PHASES } from "./constants.mjs";
import { validateRoute } from "./route.mjs";
import { JourneyValidationError, requireString } from "./validation.mjs";

export function createJourney({ id, name, route, travelers = [], rulesProfileId = "core" }) {
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
    routeExtensionDays: 0,
    dayNumber: 0,
    travelers: structuredClone(travelers),
    roles: {},
    supplies: { food: 0, water: 0 },
    currentDay: null,
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
  try {
    validateRoute(journey?.routeSnapshot);
  } catch (error) {
    issues.push(...(error.issues ?? [error.message]));
  }
  if (issues.length) throw new JourneyValidationError("Journey is invalid", issues);
  return journey;
}
