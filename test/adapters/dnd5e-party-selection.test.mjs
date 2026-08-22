import assert from "node:assert/strict";
import test from "node:test";
import { Dnd5eJourneyAdapter } from "../../scripts/adapters/dnd5e-journey-adapter.mjs";

function actor(id, { owner = true, token = null } = {}) {
  return {
    id,
    uuid: `Actor.${id}`,
    name: id,
    type: "character",
    img: `${id}-portrait.webp`,
    prototypeToken: { texture: { src: token } },
    hasPlayerOwner: owner
  };
}

test("the primary group supplies default travelers", () => {
  const member = actor("Member", { owner: false, token: "member-token.webp" });
  const outsider = actor("Outsider");
  const party = { id: "party", name: "Party", type: "group", system: { playerCharacters: [member] } };
  const collection = [party, member, outsider];
  collection.party = party;
  globalThis.game = { system: { id: "dnd5e" }, actors: collection };
  const travelers = new Dnd5eJourneyAdapter().getAvailableTravelers();
  assert.deepEqual(travelers.map(entry => entry.uuid), [member.uuid]);
  assert.equal(travelers[0].img, "member-token.webp");
  assert.equal(travelers[0].selectedByDefault, true);
  delete globalThis.game;
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
