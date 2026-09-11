import assert from "node:assert/strict";
import test from "node:test";
import { createJourney } from "../../scripts/domain/journey.mjs";
import { createRoute } from "../../scripts/domain/route.mjs";

const dialogs = [];
const sent = [];
globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: base => base,
  DialogV2: class { constructor(options) { dialogs.push(options); } async render() {} }
} } };
const { roleRollService } = await import("../../scripts/services/role-roll-service.mjs");
const { foragingRollService } = await import("../../scripts/services/foraging-roll-service.mjs");
const { forcedMarchRollService } = await import("../../scripts/services/forced-march-roll-service.mjs");
const { supplyConsequenceService } = await import("../../scripts/services/supply-consequence-service.mjs");
const { sleepRollService } = await import("../../scripts/services/sleep-roll-service.mjs");
let stored;
let config;
function setup(phase) {
  dialogs.length = sent.length = 0;
  config = { pressOn: 0, hungerBase: 0, hungerIncrease: 0, sleepDeprivationBase: 0, sleepDeprivationIncrease: 0 };
  const actor = { id: "a", uuid: "Actor.a", name: "Traveler", type: "character", items: [],
    system: { abilities: { con: { mod: 0 } }, attributes: { exhaustion: 2 } }, flags: { daysWithoutFood: 4 },
    getFlag(_module, key) { return this.flags[key]; }, async setFlag(_module, key, value) { this.flags[key] = value; },
    async update(changes) { this.system.attributes.exhaustion = changes["system.attributes.exhaustion"]; }
  };
  const actors = [actor]; actors.get = id => actors.find(a => a.id === id);
  const gm = { id: "gm", isGM: true, active: true };
  globalThis.game = { actors, user: gm, users: [gm], modules: new Map(), settings: {
    get: (_module, key) => key === "activeJourney" ? stored : key === "dcConfiguration" ? config : false,
    set: async (_module, _key, value) => { stored = structuredClone(value); }
  } };
  globalThis.MorelordCore = { socket: { createChannel: () => ({ on() {}, executeAsUser: async (...args) => sent.push(args) }) } };
  globalThis.fromUuid = async uuid => actors.find(a => a.uuid === uuid);
  globalThis.ui = { notifications: { error: message => { throw new Error(message); } } };
  const route = createRoute({ id: "route", name: "Road", origin: { name: "Start" }, destination: { name: "End" }, lengthSteps: 3, navigationDC: 0, discoveryDC: 0, resourcesDC: 0 });
  stored = createJourney({ id: "journey", name: "Journey", route, travelers: [{ actorId: actor.id, actorUuid: actor.uuid, name: actor.name }] });
  stored.phase = phase;
  stored.roles = phase === "discovery" ? { observerUuid: actor.uuid } : { navigatorUuid: actor.uuid };
  stored.currentDay = { pace: "normal" };
  return actor;
}
function noRolls() { assert.equal(dialogs.length, 0); assert.equal(sent.length, 0); }

for (const phase of ["navigation", "discovery"]) test(`${phase} DC 0 records ordinary success without a player request`, async () => {
  setup(phase);
  await roleRollService.request({ phase });
  const result = stored.currentDay.roleRollResults[phase];
  assert.equal(result.outcome, "success");
  assert.equal(result.automaticReason, "zeroDC");
  assert.equal(result.total, null);
  assert.equal(stored.currentDay.pendingRoleRoll, null);
  noRolls();
});

test("DC 0 foraging feeds the traveler without critical-success bonus food", async () => {
  setup("foraging");
  await foragingRollService.requestParty();
  assert.equal(stored.currentDay.foragingResults[0].foodFound, 1);
  assert.equal(stored.currentDay.foragingResolution.foodRequired, 0);
  assert.equal(stored.currentDay.foragingResolution.waterRequired, 0);
  assert.deepEqual(stored.currentDay.foragingResolution.excessFoodByActorUuid, {});
  assert.deepEqual(stored.currentDay.pendingForagingRolls, []);
  noRolls();
});

test("DC 0 forced march adds no Exhaustion", async () => {
  const actor = setup("pressOn");
  await forcedMarchRollService.requestParty();
  assert.equal(stored.currentDay.forcedMarchResults[0].succeeded, true);
  assert.equal(actor.system.attributes.exhaustion, 2);
  assert.deepEqual(stored.currentDay.pendingForcedMarchRolls, []);
  noRolls();
});

test("DC 0 hunger succeeds while a water shortage still adds Exhaustion", async () => {
  const actor = setup("foraging");
  stored.currentDay.supplyResolution = { shortageActorUuids: { food: [actor.uuid], water: [actor.uuid] } };
  stored.currentDay.foragingResolution = {};
  await supplyConsequenceService.begin();
  assert.equal(stored.currentDay.supplyConsequences.results[0].succeeded, true);
  assert.equal(actor.system.attributes.exhaustion, 3);
  assert.deepEqual(stored.currentDay.pendingSupplySaves, []);
  noRolls();
});

for (const hours of [6, 2]) test(`DC 0 sleep with ${hours} hours preserves Long Rest requirements`, async () => {
  const actor = setup("sleep");
  // A watch excludes the unrelated Peaceful Rest choice prompt.
  stored.currentDay.campWatches = [{ actorUuid: actor.uuid, watchIndexes: [0], action: "Watch" }];
  await sleepRollService.requestParty({ entries: [{ actorUuid: actor.uuid, dc: 0, baseDC: 10, modifiers: [], sleepHours: hours, requiredSleepHours: 6, interruptionHours: 0 }] });
  // Separate deprivation saves are dispatched after the sleep result is saved.
  await new Promise(resolve => setTimeout(resolve, 20));
  const result = stored.currentDay.campSleepResults[0];
  assert.equal(result.succeeded, true);
  assert.equal(result.automaticReason, "zeroDC");
  assert.equal(result.longRestCompleted, hours === 6);
  assert.equal(actor.system.attributes.exhaustion, hours === 6 ? 1 : 2);
  if (hours === 2) assert.equal(result.deprivation.automaticReason, "zeroDC");
  assert.deepEqual(stored.currentDay.pendingSleepRolls, []);
  noRolls();
});

test("positive forced-march DC still sends a player request", async () => {
  setup("pressOn"); config.pressOn = 12;
  game.users.unshift({ id: "player", active: true, character: { uuid: "Actor.a" } });
  forcedMarchRollService.start();
  await forcedMarchRollService.requestParty();
  assert.equal(sent.length, 1);
  assert.equal(stored.currentDay.pendingForcedMarchRolls[0].dc, 12);
  assert.deepEqual(stored.currentDay.forcedMarchResults, []);
});
