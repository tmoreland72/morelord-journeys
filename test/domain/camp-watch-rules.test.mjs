import { qualifiesForLongRest } from "../../scripts/domain/sleep-rules.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { campPeriods, campWatchAction, availableCampSleepHours, normalizeCampAssignments, validateCampAssignments, watchCoverage } from "../../scripts/domain/camp-watch-rules.mjs";

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

test("other camp actions retain watch coverage without doubling simultaneous activity time", () => {
  for (const action of ["Craft", "Cook", "Prepare", "Slumber", "Task"]) {
    const assignments = normalizeCampAssignments(travelers(1), [{ actorUuid: "Actor.0", action, watchIndexes: [2] }]);
    assert.equal(watchCoverage(assignments)[2].actorUuid, "Actor.0");
    assert.equal(availableCampSleepHours(assignments, "Actor.0"), 6);
    assert.doesNotThrow(() => validateCampAssignments(assignments));
  }
});

test("dedicated watch plus a separate camp action leaves four hours of sleep", () => {
  const assignments = [{ actorUuid: "Actor.0", action: "Take a Watch", watchIndexes: [0], additionalAction: "Craft" }];
  assert.equal(availableCampSleepHours(assignments, "Actor.0"), 4);
  assignments[0].watchIndexes.push(2);
  assert.equal(availableCampSleepHours(assignments, "Actor.0"), 2);
});

test("explicitly unassigned periods stay empty and mixed actions cannot double-book a watch", () => {
  const assignments = normalizeCampAssignments(travelers(2), [
    { actorUuid: "Actor.0", action: "Take a Watch", watchIndex: null, watchIndexes: [] },
    { actorUuid: "Actor.1", action: "Cook", watchIndexes: [0] }
  ]);
  assert.deepEqual(assignments[0].watchIndexes, []);
  assignments[0].watchIndexes = [0];
  assert.throws(() => validateCampAssignments(assignments), /Only one character/);
});

test("scheduled camp actions consume their own periods and watch checks use that period's activity", () => {
  const assignment = { actorUuid: "a", periods: [
    { watch: true, action: "Cook" }, { watch: true, action: "Take a Watch" },
    { watch: false, action: "Craft" }, { watch: false, action: "Slumber" }
  ] };
  assert.equal(availableCampSleepHours([assignment], "a"), 2);
  assert.equal(campWatchAction(assignment, 0), "Cook");
  assert.equal(campWatchAction(assignment, 1), "Take a Watch");
  assert.doesNotThrow(() => validateCampAssignments([assignment]));
  assignment.periods[0].watch = false;
  assignment.periods[1] = { watch: false, action: "Task" };
  assert.equal(availableCampSleepHours([assignment], "a"), 2);
  assert.deepEqual(watchCoverage([assignment]), [null, null, null, null]);
});

test("legacy watch and extra action become distinct periods without losing sleep time", () => {
  const assignment = { actorUuid: "a", action: "Take a Watch", watchIndexes: [1, 3], additionalAction: "Craft" };
  const migrated = { ...assignment, periods: campPeriods(assignment) };
  assert.equal(availableCampSleepHours([migrated], "a"), availableCampSleepHours([assignment], "a"));
  assert.equal(migrated.periods[0].action, "Craft");
  assert.equal(migrated.periods[2].action, "Slumber");
});

test("extra camp actions can prevent a Long Rest even after a successful sleep check", () => {
  const assignment = { actorUuid: "elf", periods: [
    { watch: true, action: "Take a Watch" }, { watch: false, action: "Craft" },
    { watch: false, action: "Slumber" }, { watch: false, action: "Slumber" }
  ] };
  const rests = () => qualifiesForLongRest({ sleepCheckSucceeded: true, sleepHours: availableCampSleepHours([assignment], "elf"), requiredSleepHours: 4, interruptionHours: 0 });
  assert.equal(rests(), true);
  assignment.periods[2].action = "Task";
  assert.equal(rests(), false);
});
