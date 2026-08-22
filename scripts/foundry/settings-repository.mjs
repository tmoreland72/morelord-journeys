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
  return value === null ? null : validateJourney(structuredClone(value));
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
