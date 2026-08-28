import assert from "node:assert/strict";
import test from "node:test";
import { Dnd5eJourneyAdapter } from "../../scripts/adapters/dnd5e-journey-adapter.mjs";

function actor(id, { owner = true, token = null, items = [] } = {}) {
  return {
    id,
    uuid: `Actor.${id}`,
    name: id,
    type: "character",
    img: `${id}-portrait.webp`,
    prototypeToken: { texture: { src: token } },
    hasPlayerOwner: owner,
    items
  };
}

test("the primary group supplies defaults while all player characters remain available", () => {
  const member = actor("Member", { owner: false, token: "member-token.webp" });
  const outsider = actor("Outsider");
  const party = { id: "party", name: "Party", type: "group", system: { playerCharacters: [member] } };
  const collection = [party, member, outsider];
  collection.party = party;
  globalThis.game = { system: { id: "dnd5e" }, actors: collection };
  const travelers = new Dnd5eJourneyAdapter().getAvailableTravelers();
  assert.deepEqual(travelers.map(entry => entry.uuid), [member.uuid, outsider.uuid]);
  assert.equal(travelers[0].img, "member-token.webp");
  assert.equal(travelers[0].selectedByDefault, true);
  assert.equal(travelers[1].selectedByDefault, false);
  delete globalThis.game;
});

test("Long Rest hours are guessed from Trance and can be adjusted by the GM", () => {
  const elf = actor("Elf", { items: [{ name: "Trance", system: { identifier: "trance" } }] });
  const adapter = new Dnd5eJourneyAdapter();
  assert.deepEqual(adapter.getLongRestRequirement(elf), { hours: 4, source: "Trance" });
  assert.equal(adapter.snapshotTraveler(elf).longRestHours, 4);
  const adjusted = adapter.snapshotTraveler(elf, { longRestHours: 5 });
  assert.equal(adjusted.longRestHours, 5);
  assert.match(adjusted.longRestHoursSource, /GM-adjusted/);
});

test("an empty group falls back to player-owned characters", () => {
  const player = actor("Player", { token: "player-token.webp" });
  const unowned = actor("Unowned", { owner: false });
  const party = { id: "party", name: "Empty Party", type: "group", system: { playerCharacters: [] } };
  const collection = [party, player, unowned];
  collection.party = party;
  globalThis.game = { system: { id: "dnd5e" }, actors: collection };
  const travelers = new Dnd5eJourneyAdapter().getAvailableTravelers();
  assert.deepEqual(travelers.map(entry => entry.uuid), [player.uuid]);
  delete globalThis.game;
});
