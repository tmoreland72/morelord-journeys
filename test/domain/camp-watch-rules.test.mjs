import test from "node:test";
import assert from "node:assert/strict";
import { availableCampSleepHours, normalizeCampAssignments, validateCampAssignments, watchCoverage } from "../../scripts/domain/camp-watch-rules.mjs";

const travelers = count => Array.from({ length: count }, (_, index) => ({ actorUuid: `Actor.${index}`, name: `Traveler ${index + 1}` }));

test("camp creates one assignment per traveler and only four default watchers", () => {
  const assignments = normalizeCampAssignments(travelers(6));
  assert.equal(assignments.length, 6);
  assert.deepEqual(assignments.map(entry => entry.action), ["Take a Watch", "Take a Watch", "Take a Watch", "Take a Watch", "Slumber", "Slumber"]);
  assert.deepEqual(watchCoverage(assignments).map(entry => entry?.actorUuid), ["Actor.0", "Actor.1", "Actor.2", "Actor.3"]);
});

test("a smaller party leaves the unassigned watch periods visible", () => {
  const assignments = normalizeCampAssignments(travelers(2));
  assert.deepEqual(watchCoverage(assignments).map(entry => entry?.actorUuid ?? null), ["Actor.0", "Actor.1", null, null]);
});

test("duplicate watch periods are rejected", () => {
  const assignments = normalizeCampAssignments(travelers(2)).map(entry => ({ ...entry, watchIndex: 2, watchIndexes: [2] }));
  assert.throws(() => validateCampAssignments(assignments), /Only one character/);
});

test("every camp assignment other than Slumber costs two hours of sleep", () => {
  const actorUuid = "Actor.0";
  assert.equal(availableCampSleepHours([{ actorUuid, action: "Slumber" }], actorUuid), 8);
  assert.equal(availableCampSleepHours([{ actorUuid, action: "Take a Watch" }], actorUuid), 6);
  assert.equal(availableCampSleepHours([{ actorUuid, action: "Craft" }], actorUuid), 6);
  assert.equal(availableCampSleepHours([{ actorUuid, action: "Cook" }], actorUuid), 6);
  assert.equal(availableCampSleepHours([{ actorUuid, action: "Prepare" }], actorUuid), 6);
  assert.equal(availableCampSleepHours([{ actorUuid, action: "Task" }], actorUuid), 6);
});

test("a four-hour sleeper can cover two watches and retain four sleep hours", () => {
  const assignments = [{ actorUuid: "Actor.0", action: "Take a Watch", watchIndex: 0, watchIndexes: [0, 2] }];
  assert.equal(availableCampSleepHours(assignments, "Actor.0"), 4);
  assert.equal(watchCoverage(assignments)[0]?.actorUuid, "Actor.0");
  assert.equal(watchCoverage(assignments)[2]?.actorUuid, "Actor.0");
  assert.doesNotThrow(() => validateCampAssignments(assignments));
});
