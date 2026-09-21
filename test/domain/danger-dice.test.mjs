import test from "node:test";
import assert from "node:assert/strict";
import { dangerDie, resolveDangerDice, resolveNightDice } from "../../scripts/domain/encounter-rules.mjs";

test("Danger determines the die and high Danger disables cancellation", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(dangerDie), [20, 12, 10, 8, 6, 4]);
  for (let danger = 0; danger <= 5; danger++) {
    const result = resolveDangerDice({ danger, results: [1, dangerDie(danger)] });
    assert.equal(result.encounterCount, danger < 4 ? 0 : 1);
  }
  assert.throws(() => dangerDie(6));
  assert.throws(() => resolveDangerDice({ danger: 5, results: [5] }));
});

test("fire triggers on two; pooled maximums cancel latest periods without losing timing", () => {
  const withoutFire = resolveNightDice({ danger: 3, results: [1, 2, 8, 1] });
  assert.deepEqual(withoutFire.encounterIndexes, [0]);
  const fire = resolveNightDice({ danger: 3, results: [1, 2, 8, 1], campfire: true });
  assert.deepEqual(fire.encounterIndexes, [0, 1]);
  assert.deepEqual(fire.encounters.map(entry => [entry.watchIndex, entry.startHour, entry.endHour]), [[0, 0, 2], [1, 2, 4]]);
  const hourly = resolveNightDice({ danger: 5, results: [4, 4, 1, 2, 4, 4, 1, 4], intervalHours: 1, campfire: true });
  assert.deepEqual(hourly.encounters.map(entry => [entry.watchIndex, entry.startHour, entry.endHour]), [[1, 2, 3], [1, 3, 4], [3, 6, 7]]);
  assert.equal(hourly.cancellations, 0);
  assert.throws(() => resolveNightDice({ danger: 0, results: [1], intervalHours: 2 }));
});
