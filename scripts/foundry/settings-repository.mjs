import { checkpointJourney, registerJourneyUndo, assertUndoComplete } from "../services/journey-undo-service.mjs";
import { MODULE_ID } from "../domain/constants.mjs";
import { validateJourney } from "../domain/journey.mjs";
import { publishJourneyProgress } from "../services/progress-chat-service.mjs";

const ACTIVE_JOURNEY_KEY = "activeJourney";

export function registerSettings() {
  registerJourneyUndo();
  game.settings.register(MODULE_ID, ACTIVE_JOURNEY_KEY, {
    name: "MORELORD_JOURNEYS.Settings.ActiveJourney.Name",
    hint: "MORELORD_JOURNEYS.Settings.ActiveJourney.Hint",
    scope: "world",
    config: false,
    type: Object,
    default: null,
    restricted: true
  });
}

export async function getActiveJourney() {
  const value = game.settings.get(MODULE_ID, ACTIVE_JOURNEY_KEY);
  if (value === null) return null;
  const journey = structuredClone(value);
  // Preserve the estimate from whole-day journeys while migrating to thirds.
  if (!Number.isInteger(journey.remainingSteps)) {
    const extensionSteps = Math.max(0, Number(journey.routeExtensionDays ?? 0)) * 3;
    journey.remainingSteps = Math.max(0, Number(journey.routeSnapshot?.lengthSteps ?? 0) + extensionSteps - Number(journey.progressSteps ?? 0));
    delete journey.routeExtensionDays;
  }
  journey.progressSteps = Math.max(0, Number(journey.routeSnapshot?.lengthSteps ?? 0) + Number(journey.routeAdjustmentSteps ?? 0) - journey.remainingSteps);
  if (!journey.currentDay && journey.remainingSteps <= 0) {
    journey.status = "arrived";
    journey.phase = null;
  }
  return validateJourney(journey);
}

export async function saveActiveJourney(journey) {
  assertUndoComplete();
  validateJourney(journey);
  const stored = game.settings.get(MODULE_ID, ACTIVE_JOURNEY_KEY);
  if (stored?.id === journey.id && (stored.undoGeneration ?? 0) !== (journey.undoGeneration ?? 0)) throw new Error("This step was undone. Reopen Journeys before retrying.");
  const prior = stored === null ? null : structuredClone(stored);
  await game.settings.set(MODULE_ID, ACTIVE_JOURNEY_KEY, journey);
  const telemetry = globalThis.MorelordCore?.telemetry;
  if (prior?.id !== journey.id) telemetry?.track(MODULE_ID, "journey.created");
  else if (prior.status !== journey.status && journey.status === "arrived") telemetry?.track(MODULE_ID, "journey.arrived");
  if (prior?.phase !== journey.phase && journey.phase) telemetry?.track(MODULE_ID, "phase.changed");
  await checkpointJourney(journey);
  await publishJourneyProgress(prior, journey);
  return journey;
}

export async function clearActiveJourney() {
  return game.settings.set(MODULE_ID, ACTIVE_JOURNEY_KEY, null);
}
