import assert from "node:assert/strict";
import test from "node:test";
import { SupplyManifestService } from "../../scripts/services/supply-manifest-service.mjs";

function item(name, quantity, extra = {}) {
  return { name, uuid: `Item.${name}`, img: "item.webp", system: { quantity, ...(extra.system ?? {}) }, flags: extra.flags ?? {} };
}

test("supply manifest includes group and traveler inventories", async () => {
  const traveler = { uuid: "Actor.hero", name: "Hero", type: "character", items: [item("Rations", 3)] };
  const group = {
    uuid: "Actor.party",
    name: "The Party",
    type: "group",
    items: [item("Waterskin", 4, { flags: { "morelord-journeys": { waterUnits: 4 } } }), item("Tent", 2)],
    system: { playerCharacters: [traveler] }
  };
  const actors = [group, traveler];
  actors.party = group;
  globalThis.game = { actors };
  globalThis.fromUuid = async uuid => actors.find(actor => actor.uuid === uuid) ?? null;

  const manifest = await new SupplyManifestService().build({ travelerUuids: [traveler.uuid] });
  assert.equal(manifest.partyActorUuid, group.uuid);
  assert.equal(manifest.totals.food, 3);
  assert.equal(manifest.totals.water, 4);
  assert.equal(manifest.totals.tent, 2);
  assert.deepEqual(manifest.sources.map(source => source.sourceType), ["group", "traveler"]);

  delete globalThis.fromUuid;
  delete globalThis.game;
});

test("water containers only count confirmed contents", async () => {
  const traveler = {
    uuid: "Actor.hero", name: "Hero", type: "character",
    items: [
      item("Waterskin", 1),
      item("Empty Waterskin", 1),
      item("Full Waterskin", 1),
      item("Water Flask", 1, { system: { uses: { max: 1, spent: 0 } } })
    ]
  };
  const actors = [traveler];
  globalThis.game = { actors };
  globalThis.fromUuid = async () => traveler;
  const manifest = await new SupplyManifestService().build({ travelerUuids: [traveler.uuid] });
  assert.equal(manifest.totals.water, 2);
  assert.equal(manifest.items.find(entry => entry.name === "Waterskin").supplyState, "unknown");
  assert.equal(manifest.items.find(entry => entry.name === "Empty Waterskin").availableQuantity, 0);
  delete globalThis.fromUuid;
  delete globalThis.game;
});

test("supply manifest works without a group actor", async () => {
  const traveler = { uuid: "Actor.hero", name: "Hero", type: "character", items: [item("Bedroll", 1)] };
  const actors = [traveler];
  globalThis.game = { actors };
  globalThis.fromUuid = async () => traveler;
  const manifest = await new SupplyManifestService().build({ travelerUuids: [traveler.uuid] });
  assert.equal(manifest.partyActorUuid, null);
  assert.equal(manifest.totals.bedroll, 1);
  delete globalThis.fromUuid;
  delete globalThis.game;
});
