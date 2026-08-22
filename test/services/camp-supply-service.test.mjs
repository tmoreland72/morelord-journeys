import assert from "node:assert/strict";
import test from "node:test";
import { CampSupplyService } from "../../scripts/services/camp-supply-service.mjs";

test("sleep plan applies shelter and weather modifiers", () => {
  const service = new CampSupplyService();
  const plan = service.buildSleepPlan({
    travelers: [{ actorUuid: "a", name: "A" }, { actorUuid: "b", name: "B" }],
    supplies: { totals: { tent: 1, bedroll: 1, blanket: 1 } },
    assignments: { a: { tent: true, bedroll: true, blanket: true }, b: { tent: true } },
    extremeWeather: true,
    coldWeather: true
  });
  assert.equal(plan.entries[0].dc, 7);
  assert.equal(plan.entries[1].dc, 10);
  assert.equal(plan.usage.tent, 1);
});

test("sleep plan rejects equipment over-allocation", () => {
  const service = new CampSupplyService();
  assert.throws(() => service.buildSleepPlan({
    travelers: [{ actorUuid: "a", name: "A" }], supplies: { totals: { bedroll: 0 } }, assignments: { a: { bedroll: true } }
  }), /Not enough bedroll/);
});
