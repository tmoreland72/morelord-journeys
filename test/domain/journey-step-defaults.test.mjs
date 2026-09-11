import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: base => base } } };
const { getJourneyStepDefaults, readJourneySteps, isPhaseEnabled, nightEncountersEnabled, sleepAndShelterEnabled } = await import("../../scripts/core/journey-settings.mjs");

test("planner starts from saved defaults and journey choices survive default changes", () => {
  const settings = { phaseWeather: false, enableNightEncounters: false };
  globalThis.game = { settings: { get: (_, key) => settings[key] } };
  const defaults = getJourneyStepDefaults();
  assert.equal(defaults.weather, false);
  assert.equal(defaults.camp, true);
  const journey = { steps: readJourneySteps({ querySelector: selector => selector === '[name="step-sleep"]' ? { checked: false } : null }) };
  settings.phaseWeather = true;
  settings.enableNightEncounters = true;
  assert.equal(isPhaseEnabled("weather", journey), false);
  assert.equal(nightEncountersEnabled(journey), false);
  assert.equal(sleepAndShelterEnabled(journey), false);
  assert.equal(getJourneyStepDefaults().weather, true);
  assert.equal(isPhaseEnabled("weather", {}), true);
  settings.journeyPlannerDefaults = { fields: { "step-weather": false, "step-sleep": false } };
  assert.equal(getJourneyStepDefaults().weather, false);
  assert.equal(getJourneyStepDefaults().sleep, false);
});
