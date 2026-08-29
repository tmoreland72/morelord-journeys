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
  assert.equal(manifest.waterUnits, 1);
  assert.equal(manifest.items.some(entry => entry.name === "Waterskin"), false);
  assert.equal(manifest.items.find(entry => entry.name === "Water (Pint)").availableQuantity, 5);
  delete globalThis.fromUuid;
  delete globalThis.game;
});

test("water inside a waterskin is counted from the contained Water item", async () => {
  const waterskin = item("Waterskin", 1);
  waterskin.id = "skin";
  waterskin.flags = { "morelord-journeys": { waterState: "full", waterUnits: 4 } };
  const water = item("Water (1 Pint)", 4, { system: { container: "skin", identifier: "water-pint" } });
  const traveler = { uuid: "Actor.hero", name: "Hero", type: "character", items: [waterskin, water] };
  const actors = [traveler];
  globalThis.game = { actors };
  globalThis.fromUuid = async () => traveler;
  const manifest = await new SupplyManifestService().build({ travelerUuids: [traveler.uuid] });
  assert.equal(manifest.totals.water, 4);
  assert.equal(manifest.waterUnits, 1);
  assert.equal(manifest.items.some(entry => entry.name === "Waterskin"), false);
  assert.equal(manifest.items.find(entry => entry.category === "water").sourceActorUuid, traveler.uuid);
  delete globalThis.fromUuid;
  delete globalThis.game;
});

test("flagged waterskins do not double count their contained pint items", async () => {
  const travelers = ["a", "b", "c"].map(id => {
    const waterskin = item(`Waterskin ${id}`, 1, { flags: { "morelord-journeys": { waterState: "full", waterUnits: 4 } } });
    waterskin.id = `skin-${id}`;
    waterskin.uuid = `Item.skin-${id}`;
    const water = item(`Water (1 Pint) ${id}`, 4, { system: { container: waterskin.id, identifier: "water-pint" } });
    water.uuid = `Item.water-${id}`;
    return { uuid: `Actor.${id}`, name: id.toUpperCase(), type: "character", items: [waterskin, water] };
  });
  const actors = [...travelers];
  globalThis.game = { actors };
  globalThis.fromUuid = async uuid => actors.find(actor => actor.uuid === uuid) ?? null;

  const manifest = await new SupplyManifestService().build({ travelerUuids: travelers.map(actor => actor.uuid) });

  assert.equal(manifest.totals.water, 12);
  assert.equal(manifest.waterUnits, 3);
  assert.equal(manifest.items.filter(entry => entry.category === "water").length, 3);
  delete globalThis.fromUuid;
  delete globalThis.game;
});

test("empty flagged water containers do not add available pints", async () => {
  const empty = item("Waterskin", 1, { flags: { "morelord-journeys": { waterState: "empty", waterUnits: 4 } } });
  const full = item("Waterskin Full", 1, { flags: { "morelord-journeys": { waterState: "full", waterUnits: 4 } } });
  full.uuid = "Item.full";
  const traveler = { uuid: "Actor.hero", name: "Hero", type: "character", items: [empty, full] };
  const actors = [traveler];
  globalThis.game = { actors };
  globalThis.fromUuid = async () => traveler;
  const manifest = await new SupplyManifestService().build({ travelerUuids: [traveler.uuid] });
  assert.equal(manifest.totals.water, 4);
  assert.equal(manifest.waterUnits, 1);
  delete globalThis.fromUuid;
  delete globalThis.game;
});

test("successful foraging refill fills known traveler and group water containers to capacity", async () => {
  const updates = [];
  const waterskin = item("Empty Waterskin", 1, { flags: { "morelord-journeys": { waterState: "empty", waterUnits: 0 } } });
  waterskin.id = "skin";
  waterskin.uuid = "Item.skin";
  waterskin.update = async change => { updates.push([waterskin.name, change]); };
  const water = item("Water (1 Pint)", 1, { system: { container: "skin", identifier: "water-pint" } });
  water.update = async change => { updates.push([water.name, change]); };
  const flask = item("Water Flask", 1);
  flask.update = async change => { updates.push([flask.name, change]); };
  const traveler = { uuid: "Actor.hero", name: "Hero", type: "character", items: [waterskin, water, flask] };
  const jug = item("Water Jug", 1);
  jug.uuid = "Item.jug";
  jug.update = async change => { updates.push([jug.name, change]); };
  const group = { uuid: "Actor.party", name: "Party", type: "group", items: [jug] };
  globalThis.fromUuid = async uuid => [traveler, group].find(actor => actor.uuid === uuid) ?? null;

  const refilled = await new SupplyManifestService().refillWaterContainers([traveler.uuid, group.uuid]);

  assert.equal(refilled.length, 3);
  assert.deepEqual(updates, [
    ["Water (1 Pint)", { "system.quantity": 4 }],
    ["Empty Waterskin", { "flags.morelord-journeys.waterUnits": 4, "flags.morelord-journeys.waterState": "full" }],
    ["Water Flask", { "flags.morelord-journeys.waterUnits": 1, "flags.morelord-journeys.waterState": "full" }],
    ["Water Jug", { "flags.morelord-journeys.waterUnits": 8, "flags.morelord-journeys.waterState": "full" }]
  ]);
  delete globalThis.fromUuid;
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

test("excess forage increases an owned ration stack or creates one", async () => {
  const updates = [];
  const ration = item("Rations", 2);
  ration.update = async change => { updates.push(change); ration.system.quantity = change["system.quantity"]; };
  const existing = { uuid: "Actor.existing", name: "Existing", items: [ration] };
  const created = { uuid: "Item.created", name: "Rations" };
  const empty = { uuid: "Actor.empty", name: "Empty", items: [], createEmbeddedDocuments: async (type, data) => { assert.equal(type, "Item"); assert.equal(data[0].system.quantity, 2); return [created]; } };
  globalThis.fromUuid = async uuid => [existing, empty].find(actor => actor.uuid === uuid) ?? null;

  const added = await new SupplyManifestService().addRations({ "Actor.existing": 1, "Actor.empty": 2 });

  assert.deepEqual(updates, [{ "system.quantity": 3 }]);
  assert.deepEqual(added.map(entry => [entry.actorUuid, entry.quantity]), [["Actor.existing", 1], ["Actor.empty", 2]]);
  delete globalThis.fromUuid;
});

test("excess forage updates owned rations through the actor inventory", async () => {
  const updates = [];
  const ration = item("Rations", 0);
  ration.id = "ration-id";
  const actor = {
    uuid: "Actor.owner",
    name: "Owner",
    items: [ration],
    updateEmbeddedDocuments: async (type, changes) => { updates.push([type, changes]); ration.system.quantity = changes[0]["system.quantity"]; }
  };
  globalThis.fromUuid = async () => actor;

  await new SupplyManifestService().addRations({ "Actor.owner": 2 });

  assert.deepEqual(updates, [["Item", [{ _id: "ration-id", "system.quantity": 2 }]]]);
  delete globalThis.fromUuid;
});
