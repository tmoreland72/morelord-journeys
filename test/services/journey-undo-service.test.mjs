import test from "node:test";
import assert from "node:assert/strict";
import { checkpointJourney, updateJourneyDocument, createJourneyRations, goBackJourney, canGoBack } from "../../scripts/services/journey-undo-service.mjs";

function setup() {
  const settings = new Map([["journeyUndo", { checkpoints: [] }]]);
  const documents = new Map();
  globalThis.game = { user: { isGM: true }, settings: {
    get: (module, key) => structuredClone(settings.get(key)),
    set: async (module, key, value) => settings.set(key, structuredClone(value))
  } };
  globalThis.Hooks = { callAll() {} };
  globalThis.fromUuid = async uuid => documents.get(uuid);
  function document(uuid, data) {
    const doc = { uuid, toObject: () => structuredClone(data), delete: async () => documents.delete(uuid),
      update: async changes => {
        for (const [path, value] of Object.entries(changes)) {
          const parts = path.split('.'); let object = data;
          for (const part of parts.slice(0, -1)) object = object[part] ??= {};
          const key = parts.at(-1);
          if (key.startsWith('-=')) delete object[key.slice(2)]; else object[key] = structuredClone(value);
        }
      },
      createEmbeddedDocuments: async (type, items) => items.map(item => document(uuid + '.Item.' + item._id, item))
    };
    documents.set(uuid, doc);
    return doc;
  }
  async function enter(phase, extra = {}) {
    const journey = { id: 'journey', dayNumber: 1, phase, status: 'active', currentDay: {}, progressSteps: 3, ...extra };
    settings.set('activeJourney', journey);
    await checkpointJourney(journey);
    return journey;
  }
  return { settings, document, enter, documents };
}

test("Go Back restores calculations, inventory, flags, Exhaustion, and created rations", async () => {
  const { settings, document, enter, documents } = setup();
  const actor = document('Actor.a', { system: { attributes: { exhaustion: 1 } }, flags: {} });
  const ration = document('Actor.a.Item.r', { system: { quantity: 4 } });
  await enter('foraging');
  await updateJourneyDocument(ration, { 'system.quantity': 3 });
  await updateJourneyDocument(actor, { 'flags.morelord-journeys.daysWithoutFood': 1 });
  await updateJourneyDocument(actor, { 'system.attributes.exhaustion': 2 });
  const [created] = await createJourneyRations(actor, { name: 'Rations', system: { quantity: 2 } });
  await enter('camp', { progressSteps: 4 });
  assert.equal(canGoBack(settings.get('activeJourney')), true);
  const restored = await goBackJourney();
  assert.equal(restored.phase, 'foraging');
  assert.equal(restored.progressSteps, 3);
  assert.equal(ration.toObject().system.quantity, 4);
  assert.equal(actor.toObject().system.attributes.exhaustion, 1);
  assert.equal(actor.toObject().flags['morelord-journeys'].daysWithoutFood, undefined);
  assert.equal(documents.has(created.uuid), false);
  assert.equal(canGoBack(restored), false);
});

test("Go Back preflights external edits and pending requests without changing documents", async () => {
  const { settings, document, enter } = setup();
  const item = document('Actor.a.Item.r', { system: { quantity: 4 } });
  await enter('foraging');
  await updateJourneyDocument(item, { 'system.quantity': 3 });
  await enter('camp');
  await item.update({ 'system.quantity': 7 });
  await assert.rejects(goBackJourney(), /changed elsewhere/);
  assert.equal(item.toObject().system.quantity, 7);
  assert.equal(settings.get('activeJourney').phase, 'camp');
  settings.get('activeJourney').currentDay.pendingCampPerceptionRolls = [{}];
  await assert.rejects(goBackJourney(), /pending player requests/);
});

test("Go Back reverses repeated updates and resumes after a failed document restoration", async () => {
  const { document, enter } = setup();
  const first = document('Actor.a.Item.1', { system: { quantity: 5 } });
  const second = document('Actor.a.Item.2', { system: { quantity: 8 } });
  await enter('foraging');
  await updateJourneyDocument(first, { 'system.quantity': 4 });
  await updateJourneyDocument(first, { 'system.quantity': 3 });
  await updateJourneyDocument(second, { 'system.quantity': 7 });
  await enter('camp');
  const update = first.update;
  first.update = async () => { throw new Error('temporary failure'); };
  await assert.rejects(goBackJourney(), /temporary failure/);
  assert.equal(second.toObject().system.quantity, 8);
  first.update = update;
  await goBackJourney();
  assert.equal(first.toObject().system.quantity, 5);
});
