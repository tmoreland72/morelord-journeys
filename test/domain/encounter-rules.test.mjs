import assert from "node:assert/strict";
import test from "node:test";
import { resolveDayEncounterChecks, resolveEncounterRoll } from "../../scripts/domain/encounter-rules.mjs";

test("Danger 4 with four travelers requires sixteen dice and cancels across the party", () => {
  const result = resolveDayEncounterChecks({ danger: 4, dieFaces: 6, travelerRolls: [
    { actorUuid: "a", results: [1, 1, 1, 2] }, { actorUuid: "b", results: [6, 6, 2, 2] },
    { actorUuid: "c", results: [1, 2, 2, 2] }, { actorUuid: "d", results: [6, 2, 2, 2] }
  ] });
  assert.equal(result.totalRolls, 16);
  assert.equal(result.ones, 4);
  assert.equal(result.maximums, 3);
  assert.equal(result.encounterCount, 1);
});
test("maximum rolls cannot produce a negative count and Danger zero makes no rolls", () => {
  assert.equal(resolveDayEncounterChecks({ danger: 2, dieFaces: 20, travelerRolls: [{ results: [20, 20] }] }).encounterCount, 0);
  assert.equal(resolveDayEncounterChecks({ danger: 0, dieFaces: 6, travelerRolls: [] }).totalRolls, 0);
  assert.throws(() => resolveDayEncounterChecks({ danger: 4, dieFaces: 6, travelerRolls: [{ results: [1] }] }));
  assert.throws(() => resolveDayEncounterChecks({ danger: 9, dieFaces: 6, travelerRolls: [] }));
  assert.throws(() => resolveDayEncounterChecks({ danger: 0, dieFaces: 1, travelerRolls: [] }));
});
test("night encounter bands and Danger modifiers remain supported", () => {
  assert.equal(resolveEncounterRoll({ raw: 25, danger: 1, night: true }).outcome, "peacefulRest");
  assert.equal(resolveEncounterRoll({ raw: 80, danger: 3, night: true }).outcome, "nightAttack");
});
