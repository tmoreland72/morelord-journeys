import { MODULE_ID } from "../domain/constants.mjs";
import { validateJourney } from "../domain/journey.mjs";
import { publishJourneyProgress } from "../services/progress-chat-service.mjs";

const ACTIVE_JOURNEY_KEY = "activeJourney";

export function registerSettings() {
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
  // Migrate journeys created by the former fractional-distance model. Each
  // completed day log now represents exactly one full route day.
  const completedDays = (journey.log ?? []).filter(entry => entry.type === "dayCompleted").length;
  if (!Number.isFinite(Number(journey.routeExtensionDays))) {
    journey.routeExtensionDays = (journey.log ?? [])
      .filter(entry => entry.type === "progressModifierAdded" && entry.dayNumber <= completedDays)
      .reduce((sum, entry) => sum + Math.max(0, -Number(entry.data?.steps ?? 0)), 0);
  }
  const effectiveLengthSteps = (journey.routeSnapshot?.lengthSteps ?? 0) + Math.max(0, Number(journey.routeExtensionDays ?? 0)) * 3;
  const normalizedProgress = Math.min(effectiveLengthSteps, completedDays * 3);
  if (journey.progressSteps !== normalizedProgress) journey.progressSteps = normalizedProgress;
  if (!journey.currentDay && normalizedProgress >= effectiveLengthSteps) {
    journey.status = "arrived";
    journey.phase = null;
  }
  return validateJourney(journey);
}

export async function saveActiveJourney(journey) {
  validateJourney(journey);
  const stored = game.settings.get(MODULE_ID, ACTIVE_JOURNEY_KEY);
  const prior = stored === null ? null : structuredClone(stored);
  await game.settings.set(MODULE_ID, ACTIVE_JOURNEY_KEY, journey);
  await publishJourneyProgress(prior, journey);
  return journey;
}

export async function clearActiveJourney() {
  return game.settings.set(MODULE_ID, ACTIVE_JOURNEY_KEY, null);
}
