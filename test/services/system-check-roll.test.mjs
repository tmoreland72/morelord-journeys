import test from "node:test";
import assert from "node:assert/strict";
import { createJourneyChatRequest } from "../../scripts/services/chat-roll-service.mjs";
import { outcomeFromSystemRolls, rollActorCheck, rollSystemCheck } from "../../scripts/services/system-check-roll.mjs";

test("system rolls keep the active d20 and do not overwrite effect advantage with false", async () => {
  const outcome = outcomeFromSystemRolls([{
    total: 18,
    dice: [{ faces: 20, results: [{ result: 4, active: false }, { result: 15, active: true }] }]
  }]);
  assert.equal(outcome.total, 18);
  assert.equal(outcome.natural, 15);

  let seen;
  globalThis.game = { keyboard: { downKeys: new Set(["AltLeft"]) } };
  const actor = {
    name: "Scout",
    rollSkill: async (config, dialog, message) => {
      seen = { config, dialog, message };
      return null;
    },
    rollSavingThrow: async (config, dialog) => {
      seen = { config, dialog, kind: "save" };
      return [{ total: 8, dice: [] }];
    }
  };
  const cancelled = await rollActorCheck(actor, { skill: "prc", dc: 12, advantage: false, disadvantage: false });
  assert.equal(cancelled.cancelled, true);
  assert.equal(seen.config.skill, "prc");
  assert.equal(seen.config.target, 12);
  assert.equal(seen.config.event.altKey, true);
  assert.equal("advantage" in seen.config, false);
  assert.equal("disadvantage" in seen.config, false);
  assert.equal(seen.dialog.configure, undefined);

  const save = await rollActorCheck(actor, { ability: "con", dc: 12, advantage: true });
  assert.equal(save.total, 8);
  assert.equal(seen.kind, "save");
  assert.equal(seen.config.ability, "con");
  assert.equal(seen.config.advantage, true);
  assert.equal("skill" in seen.config, false);
  delete globalThis.game;
});

test("a player Roll button opens the dnd5e dialog on that player's client", async () => {
  const handlers = new Map();
  const gm = { id: "gm", isGM: true };
  const player = { id: "player", isGM: false };
  const channel = {
    on: (name, handler) => handlers.set(name, handler),
    executeAsUser: async (name, data, userId) => {
      assert.equal(userId, player.id);
      const prior = game.user;
      game.user = player;
      try { return await handlers.get(name)(data); }
      finally { game.user = prior; }
    }
  };
  globalThis.game = { user: gm, keyboard: { downKeys: new Set() }, modules: new Map() };
  globalThis.MorelordCore = { socket: { createChannel: () => channel } };
  globalThis.fromUuid = async () => actor;
  let seen;
  const actor = {
    uuid: "Actor.scout",
    name: "Scout",
    isOwner: true,
    rollSkill: async (config, dialog, message) => {
      seen = { config, dialog, message, userId: game.user.id };
      return [{ total: 16, parent: { id: "message-1" }, dice: [{ faces: 20, results: [{ result: 14, active: true }] }] }];
    }
  };
  const result = await rollSystemCheck({
    actor,
    senderUserId: player.id,
    skill: "sur",
    dc: 15,
    disadvantage: true,
    message: { create: true, rollMode: "public", data: { flavor: "Foraging Check" } }
  });
  assert.equal(seen.userId, player.id);
  assert.equal(seen.config.skill, "sur");
  assert.equal(seen.config.target, 15);
  assert.equal(seen.config.disadvantage, true);
  assert.equal("advantage" in seen.config, false);
  assert.equal(seen.dialog.configure, undefined);
  assert.equal(seen.message.create, true);
  assert.equal(result.total, 16);
  assert.equal(result.natural, 14);
  assert.equal(result.messageId, "message-1");
  delete globalThis.game;
  delete globalThis.MorelordCore;
  delete globalThis.fromUuid;
});

test("journey chat requests show one Roll button", async () => {
  const created = [];
  globalThis.game = { user: { isGM: true } };
  globalThis.MorelordCore = { chatRequests: { create: async card => { created.push(card); return card; } } };
  const card = await createJourneyChatRequest("foraging", {
    id: "request-1", journeyId: "journey", dayNumber: 1, actorUuid: "Actor.a", dc: 15
  }, "Foraging Check");
  assert.equal(card.modes, false);
  assert.equal(created[0].modes, false);
  delete globalThis.game;
  delete globalThis.MorelordCore;
});
