import test from "node:test";
import assert from "node:assert/strict";
import { foragingFoodFound, resolveForagingResults } from "../../scripts/domain/foraging-rules.mjs";

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
