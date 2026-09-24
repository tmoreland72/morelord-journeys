import assert from "node:assert/strict";
import test from "node:test";
import { createJourney } from "../../scripts/domain/journey.mjs";
import { createRoute } from "../../scripts/domain/route.mjs";

const dialogs = [];
const sent = [];
globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: base => base,
  DialogV2: class { constructor(options) { dialogs.push(options); } async render() {} async close() {} }
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
  globalThis.MorelordCore = { chatRequests:{register(){},create:async request=>sent.push(request)}, socket: { runSerialized: async (_key, callback) => callback(), createChannel: () => ({ on() {}, executeAsUser: async (...args) => sent.push(args) }) } };
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

test("hunger sends daily player saves, supports disconnected-player GM rolls, and resolves once", async () => {
  const actor = setup("foraging");
  actor.flags.daysWithoutFood = 0;
  config.hungerBase = 10;
  const player = { id: "player", active: true, character: { uuid: actor.uuid } };
  game.users.unshift(player);
  stored.currentDay.supplyResolution = { shortageActorUuids: { food: [actor.uuid], water: [] } };
  stored.currentDay.foragingResolution = {};
  supplyConsequenceService.start();
  await supplyConsequenceService.begin();
  const request = stored.currentDay.pendingSupplySaves[0];
  assert.equal(request.dc, 10);
  assert.equal(request.userId, "player");
  assert.equal(sent.length, 1);
  player.active = false;
  await supplyConsequenceService.resend(request.id);
  assert.equal(stored.currentDay.pendingSupplySaves[0].userId, "gm");
  assert.equal(dialogs.length, 1);
  await Promise.all([supplyConsequenceService.autoResolve(request.id, false), supplyConsequenceService.autoResolve(request.id, false)]);
  assert.equal(actor.system.attributes.exhaustion, 3);
  assert.equal(stored.currentDay.supplyConsequences.results.length, 1);
});

for (const day of [5, 6]) test(`hunger day ${day} automatically adds exhaustion without a roll`, async () => {
  const actor = setup("foraging");
  actor.flags.daysWithoutFood = day - 1;
  stored.currentDay.supplyResolution = { shortageActorUuids: { food: [actor.uuid], water: [] } };
  stored.currentDay.foragingResolution = {};
  await supplyConsequenceService.begin();
  await supplyConsequenceService.begin();
  assert.equal(actor.system.attributes.exhaustion, 3);
  assert.equal(stored.currentDay.supplyConsequences.hungerResults[0].automatic, true);
  assert.equal(stored.currentDay.supplyConsequences.resolved, true);
  assert.deepEqual(stored.currentDay.pendingSupplySaves, []);
  noRolls();
});

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
  actor.flags.daysWithoutFood = 0;
  stored.currentDay.supplyResolution = { shortageActorUuids: { food: [actor.uuid], water: [actor.uuid] } };
  stored.currentDay.foragingResolution = {};
  await supplyConsequenceService.begin();
  assert.equal(stored.currentDay.supplyConsequences.results[0].succeeded, true);
  assert.equal(actor.system.attributes.exhaustion, 3);
  assert.deepEqual(stored.currentDay.pendingSupplySaves, []);
  noRolls();
});

for (const hours of [6, 2]) test(`2024 rest with ${hours} hours resolves without a sleep check`, async () => {
  const actor = setup("sleep");
  // A watch excludes the unrelated Peaceful Rest choice prompt.
  stored.currentDay.campWatches = [{ actorUuid: actor.uuid, watchIndexes: [0], action: "Take a Watch" }];
  await sleepRollService.requestParty({ entries: [{ actorUuid: actor.uuid, dc: 0, baseDC: 10, modifiers: [], sleepHours: hours, requiredSleepHours: 6, interruptionHours: 0 }] });
  // Separate deprivation saves are dispatched after the sleep result is saved.
  await new Promise(resolve => setTimeout(resolve, 20));
  const result = stored.currentDay.campSleepResults[0];
  assert.equal(result.succeeded, true);
  assert.equal(result.automaticReason, "rules2024");
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

test("Bufoma's completed Trance survives a later encounter and recovers Exhaustion once", async () => {
  const actor = setup("sleep");
  stored.currentDay.campWatches = [{ actorUuid: actor.uuid, periods: [
    { action: "Take a Watch", watch: true }, { action: "Slumber" }, { action: "Slumber" }, { action: "Task" }
  ] }];
  await sleepRollService.requestParty({ entries: [{ actorUuid: actor.uuid, actorName: actor.name, dc: 99,
    sleepHours: 4, requiredSleepHours: 4, interruptionSources: [{ watchIndex: 3, hours: 1 }] }] });
  const result = stored.currentDay.campSleepResults[0];
  assert.equal(result.longRestCompleted, true);
  assert.equal(result.restAssessment.completedAt, 6);
  assert.equal(actor.flags.daysWithoutLongRest, 0);
  assert.equal(actor.system.attributes.exhaustion, 1);
  await assert.rejects(sleepRollService.requestParty({ entries: [] }), /already been requested/);
  assert.equal(actor.system.attributes.exhaustion, 1);
  noRolls();
});

test("optional deprivation reroutes disconnected players to GM and resolves once", async () => {
  const actor = setup("sleep");
  config.sleepDeprivationBase = 10;
  config.sleepDeprivationIncrease = 5;
  const player = { id: "sleep-player", active: true, character: { uuid: actor.uuid } };
  game.users.unshift(player);
  sleepRollService.start();
  await sleepRollService.requestParty({ entries: [{ actorUuid: actor.uuid, actorName: actor.name, sleepHours: 2, requiredSleepHours: 6 }] });
  await new Promise(resolve => setTimeout(resolve, 20));
  const request = stored.currentDay.pendingSleepRolls[0];
  assert.equal(request.kind, "deprivation");
  assert.equal(request.userId, player.id);
  player.active = false;
  await sleepRollService.resend(request.id);
  assert.equal(stored.currentDay.pendingSleepRolls[0].userId, "gm");
  await Promise.all([sleepRollService.autoResolve(request.id, false), sleepRollService.autoResolve(request.id, false)]);
  assert.equal(stored.currentDay.campSleepResults.length, 1);
  assert.equal(stored.currentDay.pendingSleepRolls.length, 0);
  assert.equal(actor.flags.daysWithoutLongRest, 1);
  assert.equal(actor.system.attributes.exhaustion, 3);
});

test("disabled deprivation records failed rest without a save or Exhaustion", async () => {
  const actor = setup("sleep");
  const get = game.settings.get;
  game.settings.get = (module, key) => key === "suppressSleepDeprivationExhaustion" ? true : get(module, key);
  await sleepRollService.requestParty({ entries: [{ actorUuid: actor.uuid, sleepHours: 2, requiredSleepHours: 6 }] });
  assert.equal(stored.currentDay.campSleepResults[0].longRestCompleted, false);
  assert.equal(stored.currentDay.campSleepResults[0].deprivation.suppressed, true);
  assert.equal(actor.system.attributes.exhaustion, 2);
  noRolls();
});
