import test from "node:test";
import assert from "node:assert/strict";
import { foragingFoodFound, formatForagingFoodSplit, formatForagingLogResult, formatForagingOutcomeText, resolveForagingResults } from "../../scripts/domain/foraging-rules.mjs";

test("a natural 20 or total of 20 finds two food", () => {
  assert.equal(foragingFoodFound({ succeeded: true, total: 19, natural: 20 }), 2);
  assert.equal(foragingFoodFound({ succeeded: true, total: 20, natural: 12 }), 2);
  assert.equal(foragingFoodFound({ succeeded: true, total: 19, natural: 12 }), 1);
  assert.equal(foragingFoodFound({ succeeded: false, total: 20, natural: 12 }), 0);
});

test("bonus food covers failed travelers before becoming excess rations", () => {
  const travelers = ["a", "b", "c"].map(id => ({ actorUuid: `Actor.${id}` }));
  const covered = resolveForagingResults(travelers, [
    { actorUuid: "Actor.a", succeeded: true, foodFound: 2 },
    { actorUuid: "Actor.b", succeeded: true, foodFound: 1 },
    { actorUuid: "Actor.c", succeeded: false, foodFound: 0 }
  ]);
  assert.equal(covered.foodRequired, 0);
  assert.deepEqual(covered.coveredFailedActorUuids, ["Actor.c"]);
  assert.deepEqual(covered.excessFoodByActorUuid, {});

  const allSucceeded = resolveForagingResults(travelers, travelers.map((traveler, index) => ({ actorUuid: traveler.actorUuid, succeeded: true, foodFound: index === 0 ? 2 : 1 })));
  assert.deepEqual(allSucceeded.excessFoodByActorUuid, { "Actor.a": 1 });
});

test("foraging summary includes pool and excess clauses only when those amounts are greater than zero", () => {
  const poolOnly = { totalFoodFound: 3, excessFoodByActorUuid: {} };
  const excessOnly = { totalFoodFound: 2, excessFoodByActorUuid: { "Actor.a": 2 } };
  const none = { totalFoodFound: 0, excessFoodByActorUuid: {} };
  const both = { totalFoodFound: 4, excessFoodByActorUuid: { "Actor.a": 1 } };

  assert.equal(formatForagingFoodSplit(poolOnly), "Found 3 food: 3 to pool");
  assert.equal(formatForagingFoodSplit(excessOnly), "Found 2 food: 2 excess to foragers");
  assert.equal(formatForagingFoodSplit(none), "Found 0 food");
  assert.equal(formatForagingFoodSplit(both), "Found 4 food: 3 to pool, 1 excess to foragers");

  for (const resolution of [poolOnly, excessOnly, none, both]) {
    const split = formatForagingFoodSplit(resolution);
    assert.equal(formatForagingOutcomeText(resolution).startsWith(`${split};`), true);
    assert.equal(formatForagingLogResult(resolution).startsWith(`${split};`), true);
  }
  assert.equal(formatForagingFoodSplit(poolOnly).includes("excess"), false);
  assert.equal(formatForagingFoodSplit(excessOnly).includes("to pool"), false);
  assert.equal(formatForagingFoodSplit(none).includes("to pool"), false);
});
