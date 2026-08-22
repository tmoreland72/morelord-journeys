import assert from "node:assert/strict";
import test from "node:test";
import {
  DANGER_OPTIONS,
  DISCOVERY_OPTIONS,
  LENGTH_OPTIONS,
  NAVIGATION_OPTIONS,
  RESOURCE_OPTIONS
} from "../../scripts/domain/route-options.mjs";

test("route option sets expose ordered numeric values", () => {
  assert.equal(LENGTH_OPTIONS.length, 100);
  assert.deepEqual(DANGER_OPTIONS.map(option => option.value), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(DISCOVERY_OPTIONS.map(option => option.value), [5, 10, 15, 20, 25]);
  assert.deepEqual(RESOURCE_OPTIONS.map(option => option.value), [5, 10, 15, 20, 25, 30]);
  assert.deepEqual(NAVIGATION_OPTIONS.map(option => option.value), [5, 10, 15, 20, 25, 30]);
});

test("resource options describe terrain and discovery options describe likelihood", () => {
  assert.ok(RESOURCE_OPTIONS.every(option => option.label.includes("DC")));
  assert.match(RESOURCE_OPTIONS[0].label, /forest|meadow/i);
  assert.match(DISCOVERY_OPTIONS[0].label, /likely/i);
  assert.match(NAVIGATION_OPTIONS[3].label, /challenging/i);
});
