import assert from "node:assert/strict";
import test from "node:test";
import { SupplyConsumptionService } from "../../scripts/services/supply-consumption-service.mjs";

test("supply allocation prefers group inventory and reports shortages", () => {
  const service = new SupplyConsumptionService();
  const manifest = { items: [
    { category: "food", itemUuid: "traveler", name: "Rations", sourceActorName: "Hero", sourceType: "traveler", availableQuantity: 3 },
    { category: "food", itemUuid: "group", name: "Rations", sourceActorName: "Party", sourceType: "group", availableQuantity: 2 },
    { category: "water", itemUuid: "water", name: "Full Waterskin", sourceActorName: "Party", sourceType: "group", availableQuantity: 1 }
  ] };
  const plan = service.plan(manifest, { food: 4, water: 2 });
  assert.deepEqual(plan.allocations.map(entry => [entry.itemUuid, entry.quantity]), [["group", 2], ["traveler", 2], ["water", 1]]);
  assert.deepEqual(plan.shortages, { food: 0, water: 1 });
});

test("traveler allocation uses personal supplies before group and never another traveler", () => {
  const service = new SupplyConsumptionService();
  const manifest = { items: [
    { category: "food", itemUuid: "affrun", sourceActorUuid: "a", sourceActorName: "Affrun", sourceType: "traveler", availableQuantity: 10, name: "Rations" },
    { category: "food", itemUuid: "doorin", sourceActorUuid: "d", sourceActorName: "Doorin", sourceType: "traveler", availableQuantity: 1, name: "Rations" },
    { category: "food", itemUuid: "party", sourceActorUuid: "p", sourceActorName: "Party", sourceType: "group", availableQuantity: 1, name: "Rations" }
  ] };
  const plan = service.planForTravelers(manifest, {
    travelers: [{ actorUuid: "a", name: "Affrun" }, { actorUuid: "d", name: "Doorin" }, { actorUuid: "t", name: "Thalia" }],
    foodActorUuids: ["d", "t"]
  });
  assert.deepEqual(plan.allocations.map(entry => [entry.consumerActorUuid, entry.itemUuid]), [["d", "doorin"], ["t", "party"]]);
  assert.equal(plan.allocations.some(entry => entry.itemUuid === "affrun"), false);
  assert.deepEqual(plan.shortageActorUuids.food, []);
});
