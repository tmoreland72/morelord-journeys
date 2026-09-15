import test from "node:test";
import assert from "node:assert/strict";
import { createJourney } from "../../scripts/domain/journey.mjs";
import { createRoute } from "../../scripts/domain/route.mjs";
const handlers = new Map();
const dialogs = [];
globalThis.foundry = { utils: { escapeHTML: value => value }, applications: { api: {
  ApplicationV2: class {}, HandlebarsApplicationMixin: base => base,
  DialogV2: class { constructor(options) { dialogs.push(options); } async render() {} async close() {} }
} } };
const { peacefulRestService } = await import("../../scripts/services/peaceful-rest-service.mjs");
const gm = { id: "gm", isGM: true, active: true };
let stored, updates = 0;
const actor = { uuid: "Actor.hero", name: "Hero", system: { attributes: { inspiration: false } }, update: async data => { updates++; actor.system.attributes.inspiration = data["system.attributes.inspiration"]; } };
globalThis.game = { user: gm, users: [gm], modules: new Map(), settings: {
  get: (_module, key) => key === "activeJourney" ? stored : undefined,
  set: async (_module, key, value) => { if (key === "activeJourney") stored = structuredClone(value); }
} };
globalThis.MorelordCore = { socket: { createChannel: () => ({ on: (type, handler) => handlers.set(type, handler), executeAsUser: async () => {} }) } };
globalThis.fromUuid = async uuid => uuid === actor.uuid ? actor : null;
peacefulRestService.start();

test("offline player benefits route to GM, Inspiration updates the sheet and duplicate results do nothing", async () => {
  const route = createRoute({ id: "route", origin: { name: "A" }, destination: { name: "B" }, lengthSteps: 6 });
  stored = createJourney({ id: "journey", route });
  stored.currentDay = { peacefulRestEligible: [actor.uuid], peacefulRestChoices: [] };
  await peacefulRestService.requestEligible();
  const pending = stored.currentDay.pendingPeacefulRestChoices[0];
  assert.equal(pending.userId, gm.id);
  assert.equal(pending.fallbackToGM, true);
  assert.equal(dialogs[0].position.width, 860);
  await dialogs[0].buttons.find(button => button.action === "inspiration").callback();
  assert.equal(actor.system.attributes.inspiration, true);
  assert.equal(stored.currentDay.peacefulRestChoices[0].appliedAutomatically, true);
  assert.equal(stored.currentDay.pendingPeacefulRestChoices.length, 0);
  await handlers.get("peacefulRest.result")({ requestId: pending.id, choice: "inspiration" });
  assert.equal(updates, 1);
});
