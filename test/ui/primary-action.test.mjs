import test from "node:test";
import assert from "node:assert/strict";
import { primaryActionSelectors } from "../../scripts/ui/primary-action.mjs";

test("encounters prioritizes the explicit roll before continue", () => {
  assert.deepEqual(primaryActionSelectors({ hasJourney: true, journey: { phase: "encounters", currentDay: {} } }), ["[data-action='rollEncounterChecks']"]);
  assert.deepEqual(primaryActionSelectors({ hasJourney: true, journey: { phase: "encounters", currentDay: { encounterCheck: {} } } }), ["[data-action='advancePhase']"]);
});

test("sleep promotes continue only after every result is complete", () => {
  const journey = { phase: "sleep", travelers: [{}, {}], currentDay: { campSleepResults: [{}] } };
  assert.deepEqual(primaryActionSelectors({ hasJourney: true, journey }), ["[data-action='rollCampSleep']"]);
  journey.currentDay.campSleepResults.push({});
  assert.deepEqual(primaryActionSelectors({ hasJourney: true, journey }), ["[data-action='advancePhase']"]);
});

test("foraging and press on prioritize their roll requests", () => {
  assert.equal(primaryActionSelectors({ hasJourney: true, journey: { phase: "foraging", currentDay: {} } })[0], "[data-action='requestForagingRolls']");
  assert.equal(primaryActionSelectors({ hasJourney: true, journey: { phase: "pressOn", currentDay: {} } })[0], "[data-action='requestForcedMarchRolls']");
});
