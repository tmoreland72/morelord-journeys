import test from "node:test";
import assert from "node:assert/strict";
import { adjustActorExhaustion, exhaustionLevel } from "../../scripts/services/actor-exhaustion-service.mjs";

function actorWith(exhaustion) {
  return {
    name: "Traveler",
    system: { attributes: { exhaustion } },
    async update(change) {
      if ("system.attributes.exhaustion" in change) this.system.attributes.exhaustion = change["system.attributes.exhaustion"];
      if ("system.attributes.exhaustion.value" in change) this.system.attributes.exhaustion.value = change["system.attributes.exhaustion.value"];
    }
  };
}

test("exhaustion reductions update numeric D&D5e exhaustion", async () => {
  const actor = actorWith(3);
  assert.deepEqual(await adjustActorExhaustion(actor, -1), { before: 3, after: 2, change: -1 });
  assert.equal(exhaustionLevel(actor), 2);
});

test("exhaustion supports an object-shaped value and clamps at zero", async () => {
  const actor = actorWith({ value: 1 });
  assert.deepEqual(await adjustActorExhaustion(actor, -2), { before: 1, after: 0, change: -1 });
  assert.equal(exhaustionLevel(actor), 0);
});
