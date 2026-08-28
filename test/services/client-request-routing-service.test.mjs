import test from "node:test";
import assert from "node:assert/strict";
import {
  activePlayerForActor,
  firstPartyRequestRecipient,
  requestRecipientForActor
} from "../../scripts/services/client-request-routing-service.mjs";

function actor(uuid, ownerIds = []) {
  return {
    uuid,
    testUserPermission(user, permission) {
      return permission === "OWNER" && ownerIds.includes(user.id);
    }
  };
}

const gm = { id: "gm", name: "GM", active: true, isGM: true };
const player = { id: "player", name: "Player", active: true, isGM: false };

test("an active assigned player is preferred over the GM", () => {
  const traveler = actor("Actor.hero", ["gm", "player"]);
  player.character = { uuid: traveler.uuid };
  assert.equal(activePlayerForActor(traveler, { users: [gm, player] }), player);
  assert.deepEqual(
    requestRecipientForActor(traveler, { users: [gm, player], requestingUser: gm }),
    { user: player, fallbackToGM: false }
  );
});

test("the GM is used only when no owning player is active", () => {
  const offlinePlayer = { id: "player", active: false, isGM: false, character: { uuid: "Actor.hero" } };
  const traveler = actor("Actor.hero", ["gm", "player"]);
  assert.deepEqual(
    requestRecipientForActor(traveler, { users: [gm, offlinePlayer], requestingUser: gm }),
    { user: gm, fallbackToGM: true }
  );
});

test("party requests select an online owner before falling back to the GM", () => {
  const first = actor("Actor.first", ["gm"]);
  const second = actor("Actor.second", ["gm", "player"]);
  player.character = { uuid: second.uuid };
  assert.deepEqual(
    firstPartyRequestRecipient([first, second], { users: [gm, player], requestingUser: gm }),
    { user: player, actor: second, fallbackToGM: false }
  );
});
