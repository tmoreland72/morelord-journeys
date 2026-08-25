import assert from "node:assert/strict";
import test from "node:test";
import { CampSupplyService } from "../../scripts/services/camp-supply-service.mjs";

test("sleep plan applies shelter and weather modifiers", () => {
  const service = new CampSupplyService();
  const plan = service.buildSleepPlan({
    travelers: [{ actorUuid: "a", name: "A" }, { actorUuid: "b", name: "B" }],
    supplies: { items: [
      { category: "tent", sourceActorUuid: "a", availableQuantity: 1 },
      { category: "bedroll", sourceActorUuid: "a", availableQuantity: 1 },
      { category: "blanket", sourceActorUuid: "a", availableQuantity: 1 },
      { category: "tent", sourceActorUuid: "b", availableQuantity: 1 }
    ] },
    assignments: { a: { tent: true, bedroll: true, blanket: true }, b: { tent: true } },
    extremeWeather: true,
    coldWeather: true,
    peacefulNight: true
  });
  assert.equal(plan.entries[0].dc, 2);
  assert.equal(plan.entries[1].dc, 5);
  assert.deepEqual(plan.entries[0].modifiers.at(-1), { id: "peacefulNight", value: -5 });
  assert.equal(plan.usage.tent, 2);
});

test("sleep plan rejects equipment over-allocation", () => {
  const service = new CampSupplyService();
  assert.throws(() => service.buildSleepPlan({
    travelers: [{ actorUuid: "a", name: "A" }], supplies: { items: [] }, assignments: { a: { bedroll: true } }
  }), /does not own an available bedroll/);
});

test("sleep gear cannot be borrowed from another traveler or the group", () => {
  const service = new CampSupplyService();
  assert.throws(() => service.buildSleepPlan({
    travelers: [{ actorUuid: "a", name: "A" }],
    supplies: { items: [{ category: "tent", sourceActorUuid: "b", sourceType: "traveler", availableQuantity: 1 }, { category: "tent", sourceActorUuid: "g", sourceType: "group", availableQuantity: 1 }] },
    assignments: { a: { tent: true } }
  }), /does not own/);
});
