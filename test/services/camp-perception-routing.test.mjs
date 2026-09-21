import test from "node:test";
import assert from "node:assert/strict";
import { createJourney } from "../../scripts/domain/journey.mjs";
import { createRoute } from "../../scripts/domain/route.mjs";
const handlers = new Map(), dialogs = [], sent = [];
globalThis.foundry = { utils: { escapeHTML: value => value }, applications: { api: {
  ApplicationV2: class {}, HandlebarsApplicationMixin: cls => cls,
  DialogV2: class { constructor(options) { dialogs.push(options); } async render() {} async close() {} }
} } };
const { campPerceptionRollService: service } = await import("../../scripts/services/camp-perception-roll-service.mjs");

test("watch checks reroute after disconnect and resolve once through the serialized GM channel", async () => {
  const gm = { id: "gm", isGM: true, active: true }, player = { id: "player", active: true, isGM: false };
  const users = [gm, player]; users.get = id => users.find(user => user.id === id);
  const actor = { uuid: "Actor.a", name: "A", testUserPermission: user => user.id === player.id, rollSkill: async () => ({ total: 12 }) };
  let stored = createJourney({ id: "j", route: createRoute({ id: "r", origin: { name: "A" }, destination: { name: "B" }, lengthSteps: 3 }), travelers: [{ actorUuid: actor.uuid, name: actor.name }] });
  stored.phase = "camp"; stored.dayNumber = 1;
  stored.currentDay = { nightEncounterCheck: { encounters: [{ watchIndex: 1, startHour: 2, endHour: 3 }, { watchIndex: 1, startHour: 3, endHour: 4 }] } };
  const channel = {
    on: (name, handler, options) => handlers.set(name, { handler, options }),
    executeAsUser: async (name, data, id) => {
      if (name === "campPerception.request") { sent.push(data); return; }
      const senderUserId = game.user.id, prior = game.user;
      game.user = users.get(id);
      try { return await handlers.get(name).handler(data, { senderUserId }); }
      finally { game.user = prior; }
    }
  };
  globalThis.game = { user: gm, users, modules: new Map(), settings: {
    get: (module, key) => key === "activeJourney" ? structuredClone(stored) : undefined,
    set: async (module, key, value) => { if (key === "activeJourney") stored = structuredClone(value); }
  } };
  globalThis.MorelordCore = { socket: { createChannel: () => channel } };
  globalThis.fromUuid = async () => actor;
  service.start();
  await service.request({ watchIndex: 1, actorUuid: actor.uuid });
  assert.equal(sent.length, 1);
  const request = stored.currentDay.pendingCampPerceptionRolls[0];
  assert.match(request.timing, /2–3 hours.*3–4 hours/);
  player.active = false;
  await service.resend(request.id);
  assert.equal(stored.currentDay.pendingCampPerceptionRolls[0].userId, gm.id);
  assert.equal(handlers.get("campPerception.result").options.serialize, "morelord-journeys:journey-state");
  await dialogs.at(-1).buttons[0].callback();
  assert.equal(stored.currentDay.pendingCampPerceptionRolls.length, 0);
  assert.equal(stored.currentDay.campPerceptionResults.length, 1);
  assert.equal(stored.currentDay.campPerceptionResults[0].total, 12);
  const stale = await handlers.get("campPerception.result").handler({ requestId: request.id, result: { total: 20 } }, { senderUserId: player.id });
  assert.equal(stale.accepted, false);
  assert.equal(stored.currentDay.campPerceptionResults[0].total, 12);
});
