import { MODULE_ID } from "../domain/constants.mjs";
import { getMorelordSocketChannel, JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";
import { activeGM } from "./client-request-routing-service.mjs";

export function startJourneyUndo() {
  getMorelordSocketChannel().on("journey.goBack", (_data, execution) => {
    if (!game.users.get(execution.senderUserId)?.isGM) throw new Error("Only the GM can go back.");
    return goBackJourney();
  }, { serialize: JOURNEY_STATE_SERIAL_KEY });
}

export function requestGoBack() {
  if (!game.user?.isGM) throw new Error("Only the GM can go back.");
  return getMorelordSocketChannel().executeAsUser("journey.goBack", {}, activeGM()?.id ?? game.user.id);
}

export const UNDO_SETTING = "journeyUndo";
const read = () => structuredClone(game.settings.get(MODULE_ID, UNDO_SETTING) ?? { checkpoints: [] });
const write = value => game.settings.set(MODULE_ID, UNDO_SETTING, value);
const active = () => globalThis.game?.settings?.get?.(MODULE_ID, "activeJourney");
const phaseKey = journey => `${journey?.id}:${journey?.dayNumber}:${journey?.phase}:${journey?.status}`;
const get = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const field = (object, path) => {
  const value = get(object, path);
  return value === undefined ? { exists: false } : { exists: true, value: structuredClone(value) };
};
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const removal = path => { const parts = path.split("."); parts[parts.length - 1] = "-=" + parts.at(-1); return parts.join("."); };
let queue = Promise.resolve();
let rewinding = false;
const serial = action => { const result = queue.then(action); queue = result.catch(() => {}); return result; };

export function registerJourneyUndo() {
  game.settings.register(MODULE_ID, UNDO_SETTING, { name: "Journey undo history", scope: "world", config: false, type: Object, default: { checkpoints: [] }, restricted: true });
}

export async function checkpointJourney(journey) {
  if (!game.user?.isGM || !journey || rewinding) return;
  return serial(async () => {
    const current = active();
    if (current?.id === journey.id && (phaseKey(current) !== phaseKey(journey) || (current.undoGeneration ?? 0) !== (journey.undoGeneration ?? 0))) return;
    const history = read();
    if (!Array.isArray(history.checkpoints)) return; // Legacy test/adaptor without this setting.
    if (history.undoTarget !== undefined) return;
    if (history.journeyId !== journey.id) { history.journeyId = journey.id; history.checkpoints = []; }
    if (history.checkpoints.at(-1)?.key === phaseKey(journey)) return;
    history.checkpoints.push({ key: phaseKey(journey), journey: structuredClone(journey), changes: [] });
    // ponytail: retain two travel days of checkpoints; external archive if longer undo is needed.
    history.checkpoints = history.checkpoints.slice(-24);
    await write(history);
  });
}

export function canGoBack(journey) {
  const history = read();
  return game.user?.isGM && history.journeyId === journey?.id && history.checkpoints?.length > 1;
}

export function assertUndoComplete() {
  if (read().undoTarget !== undefined) throw new Error("Finish Go Back before changing this journey.");
}

export async function updateJourneyDocument(document, changes, update = () => document.update(changes)) {
  // Services also run in isolated tests and may be reused without an active Journey.
  const journey = active();
  if (!journey?.id || !document.uuid || !document.toObject) return update();
  await checkpointJourney(journey);
  return serial(async () => {
    if (rewinding) throw new Error("Wait for Go Back to finish.");
    assertUndoComplete();
    if (phaseKey(active()) !== phaseKey(journey) || (active()?.undoGeneration ?? 0) !== (journey.undoGeneration ?? 0)) throw new Error("This step was changed or undone; reopen Journeys before retrying.");
    const history = read();
    const checkpoint = history.checkpoints.at(-1);
    const paths = Object.keys(changes).filter(path => path !== "_id");
    const before = Object.fromEntries(paths.map(path => [path, field(document.toObject(), path)]));
    const entry = { uuid: document.uuid, before, after: Object.fromEntries(paths.map(path => [path, { exists: true, value: structuredClone(changes[path]) }])) };
    checkpoint.changes.push(entry);
    await write(history); // Persist the inverse before changing the document.
    const result = await update();
    entry.after = Object.fromEntries(paths.map(path => [path, field(document.toObject(), path)]));
    await write(history);
    return result;
  });
}

export async function createJourneyRations(actor, data) {
  const journey = active();
  if (!journey?.id || !actor.toObject) return actor.createEmbeddedDocuments("Item", [data]);
  await checkpointJourney(journey);
  return serial(async () => {
    assertUndoComplete();
    if (phaseKey(active()) !== phaseKey(journey) || (active()?.undoGeneration ?? 0) !== (journey.undoGeneration ?? 0)) throw new Error("This step was changed or undone; reopen Journeys before retrying.");
    const id = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    const history = read();
    const entry = { uuid: `${actor.uuid}.Item.${id}`, created: true, expected: { ...data, _id: id } };
    history.checkpoints.at(-1).changes.push(entry);
    await write(history);
    const created = await actor.createEmbeddedDocuments("Item", [{ ...data, _id: id }], { keepId: true });
    entry.expected = created[0].toObject();
    delete entry.expected._stats;
    await write(history);
    return created;
  });
}

export async function goBackJourney() {
  if (!game.user?.isGM) throw new Error("Only the GM can go back.");
  return serial(async () => {
    const history = read();
    const journey = active();
    if (history.journeyId !== journey?.id || history.checkpoints.length < 2) throw new Error("No earlier recorded step is available.");
    if (Object.entries(journey.currentDay ?? {}).some(([key, value]) => key.startsWith("pending") && (Array.isArray(value) ? value.length : value && typeof value === "object"))) throw new Error("Resolve pending player requests before going back.");
    const targetIndex = history.undoTarget ?? history.checkpoints.length - 2;
    const changes = history.checkpoints.slice(targetIndex).flatMap(entry => entry.changes).filter(entry => !entry.undone).reverse();
    const documents = new Map();
    const simulated = new Map();
    // Preflight the entire reverse chain before changing anything.
    for (const entry of changes) {
      if (!documents.has(entry.uuid)) {
        const document = await fromUuid(entry.uuid);
        documents.set(entry.uuid, document);
        const data = document?.toObject();
        if (data) delete data._stats;
        simulated.set(entry.uuid, data);
      }
      const data = simulated.get(entry.uuid);
      if (entry.created) {
        if (data && !equal(data, entry.expected)) throw new Error("A Journey-created item has changed elsewhere. Resolve that change before going back.");
        simulated.set(entry.uuid, null);
        continue;
      }
      if (!data) throw new Error("An affected character or item is missing; Go Back made no changes.");
      for (const [path, before] of Object.entries(entry.before)) {
        const current = field(data, path);
        if (!equal(current, entry.after[path]) && !equal(current, before)) throw new Error("An affected inventory or character value changed elsewhere. Go Back made no changes.");
        const parts = path.split("."); let object = data;
        for (const part of parts.slice(0, -1)) object = object[part] ??= {};
        if (before.exists) object[parts.at(-1)] = structuredClone(before.value);
        else delete object[parts.at(-1)];
      }
    }
    rewinding = true;
    try {
      history.undoTarget = targetIndex;
      await write(history);
      for (const entry of changes) {
        const document = documents.get(entry.uuid);
        if (entry.created) { if (document) await document.delete(); }
        else {
          const updates = Object.fromEntries(Object.entries(entry.before).map(([path, before]) => [before.exists ? path : removal(path), before.exists ? before.value : null]));
          await document.update(updates);
        }
        entry.undone = true;
        await write(history);
      }
      const restored = structuredClone(history.checkpoints[targetIndex].journey);
      restored.undoGeneration = (journey.undoGeneration ?? 0) + 1;
      await game.settings.set(MODULE_ID, "activeJourney", restored);
      history.checkpoints = history.checkpoints.slice(0, targetIndex + 1);
      history.checkpoints[targetIndex].changes = [];
      history.checkpoints[targetIndex].journey = structuredClone(restored);
      delete history.undoTarget;
      await write(history);
      return restored;
    } finally { rewinding = false; }
  });
}
