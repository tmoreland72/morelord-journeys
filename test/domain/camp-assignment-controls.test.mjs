import test from "node:test";
import assert from "node:assert/strict";
import { readCampAssignments } from "../../scripts/ui/camp-assignment-controls.mjs";

test("camp controls preserve watches with other actions and read a separate extra action", () => {
  const values = { watchAction0: "Cook", watchPeriod0: "2", additionalWatchPeriod0: "", watchActionExtra0: "" };
  const element = { querySelector: selector => { const value = values[selector.match(/name='([^']+)'/)[1]]; return value === undefined ? null : { value }; } };
  const journey = { travelers: [{ actorUuid: "a", name: "A" }] };
  let assignment = readCampAssignments(element, journey)[0];
  assert.deepEqual(assignment.watchIndexes, [2]);
  assert.equal(assignment.action, "Cook");
  values.watchAction0 = "Take a Watch";
  values.watchActionExtra0 = "Craft";
  assignment = readCampAssignments(element, journey)[0];
  assert.equal(assignment.additionalAction, "Craft");
  values.watchPeriod0 = "";
  assert.deepEqual(readCampAssignments(element, journey)[0].watchIndexes, []);
});

 test("four slots support separate actions, multiple watches and sleep", () => {
  const values = { "watchAction0-0": { value: "Cook" }, "campWatch0-0": { checked: true }, "watchAction0-1": { value: "Take a Watch" }, "campWatch0-1": { checked: true }, "watchAction0-2": { value: "Craft" }, "campWatch0-2": { checked: false }, "watchAction0-3": { value: "Slumber" }, "campWatch0-3": { checked: false } };
  const element = { querySelector: selector => values[selector.match(/name='([^']+)'/)[1]] ?? null };
  const [assignment] = readCampAssignments(element, { travelers: [{ actorUuid: "a", name: "A" }] });
  assert.deepEqual(assignment.watchIndexes, [0, 1]);
  assert.deepEqual(assignment.periods.map(period => period.action), ["Cook", "Take a Watch", "Craft", "Slumber"]);
});
