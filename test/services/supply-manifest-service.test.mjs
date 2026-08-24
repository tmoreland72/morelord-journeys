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
    items: [item("Water (Pint)", 4), item("Waterskin", 4), item("Tent", 2)],
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

test("water supply counts Water (Pint) and ignores containers", async () => {
  const traveler = {
    uuid: "Actor.hero", name: "Hero", type: "character",
    items: [
      item("Waterskin", 1),
      item("Empty Waterskin", 1),
      item("Full Waterskin", 1),
      item("Water Flask", 1),
      item("Water (Pint)", 5)
    ]
  };
  const actors = [traveler];
  globalThis.game = { actors };
  globalThis.fromUuid = async () => traveler;
  const manifest = await new SupplyManifestService().build({ travelerUuids: [traveler.uuid] });
  assert.equal(manifest.totals.water, 5);
  assert.equal(manifest.items.some(entry => entry.name === "Waterskin"), false);
  assert.equal(manifest.items.find(entry => entry.name === "Water (Pint)").availableQuantity, 5);
  delete globalThis.fromUuid;
  delete globalThis.game;
});

test("water inside a waterskin is counted from the contained Water item", async () => {
  const waterskin = item("Waterskin", 1);
  waterskin.id = "skin";
  const water = item("Water (1 Pint)", 4, { system: { container: "skin", identifier: "water-pint" } });
  const traveler = { uuid: "Actor.hero", name: "Hero", type: "character", items: [waterskin, water] };
  const actors = [traveler];
  globalThis.game = { actors };
  globalThis.fromUuid = async () => traveler;
  const manifest = await new SupplyManifestService().build({ travelerUuids: [traveler.uuid] });
  assert.equal(manifest.totals.water, 4);
  assert.equal(manifest.items.find(entry => entry.category === "water").sourceActorUuid, traveler.uuid);
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
