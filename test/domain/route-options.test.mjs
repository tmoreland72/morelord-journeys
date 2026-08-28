import assert from "node:assert/strict";
import test from "node:test";
import {
  DANGER_OPTIONS,
  DISCOVERY_OPTIONS,
  LENGTH_OPTIONS,
  LENGTH_THIRD_OPTIONS,
  NAVIGATION_OPTIONS,
  RESOURCE_OPTIONS,
  routeOptionsWithDCs
} from "../../scripts/domain/route-options.mjs";

test("route option sets expose ordered numeric values", () => {
  assert.equal(LENGTH_OPTIONS.length, 101);
  assert.deepEqual(LENGTH_THIRD_OPTIONS.map(option => option.value), [0, 1, 2]);
  assert.deepEqual(DANGER_OPTIONS.map(option => option.value), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(DISCOVERY_OPTIONS.map(option => option.value), [5, 10, 15, 20, 25]);
  assert.deepEqual(RESOURCE_OPTIONS.map(option => option.value), [5, 10, 15, 20, 25, 30]);
  assert.deepEqual(NAVIGATION_OPTIONS.map(option => option.value), [5, 10, 15, 20, 25, 30]);
});

test("route option labels and values use configured DCs", () => {
  const configured = routeOptionsWithDCs(NAVIGATION_OPTIONS, [2, 7, 12, 17, 22, 27]);
  assert.deepEqual(configured.map(option => option.value), [2, 7, 12, 17, 22, 27]);
  assert.equal(configured[3].label, "Challenging — DC 17");
});

test("resource options describe terrain and discovery options describe likelihood", () => {
  assert.ok(RESOURCE_OPTIONS.every(option => option.label.includes("DC")));
  assert.match(RESOURCE_OPTIONS[0].label, /forest|meadow/i);
  assert.match(DISCOVERY_OPTIONS[0].label, /likely/i);
  assert.match(NAVIGATION_OPTIONS[3].label, /challenging/i);
});
