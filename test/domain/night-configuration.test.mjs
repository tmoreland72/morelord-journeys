import test from "node:test";
import assert from "node:assert/strict";
import { nightEncounterConfiguration, validateNightEncounterConfiguration, resolveEncounterRoll } from "../../scripts/domain/encounter-rules.mjs";

test("custom night cutoffs and Danger modifiers apply at inclusive boundaries without changing daytime rules", () => {
  const configuration = validateNightEncounterConfiguration(nightEncounterConfiguration({ peacefulMax: 10, uneventfulMax: 20, minorMax: 90, dangerModifiers: [0, 3, 6, 9, 12, 15] }));
  for (const [raw, expected] of [[7, "peacefulRest"], [8, "uneventful"], [17, "uneventful"], [18, "minor"], [87, "minor"], [88, "nightAttack"]]) {
    assert.equal(resolveEncounterRoll({ raw, danger: 1, night: true, configuration }).outcome, expected);
  }
  assert.equal(resolveEncounterRoll({ raw: 39, danger: 1, configuration }).outcome, "none");
  assert.equal(resolveEncounterRoll({ raw: 90, danger: 1, night: true, configuration, modifiers: [{ value: -10 }] }).outcome, "minor");
});

test("night defaults remain unchanged and invalid settings are rejected", () => {
  assert.equal(resolveEncounterRoll({ raw: 30, danger: 1, night: true }).outcome, "peacefulRest");
  for (const overrides of [{ peacefulMax: 60 }, { minorMax: 101 }, { badWeather: NaN }, { poorCamp: 0.5 }, { stoppedDangerReduction: 6 }]) {
    assert.throws(() => validateNightEncounterConfiguration(nightEncounterConfiguration(overrides)));
  }
});
