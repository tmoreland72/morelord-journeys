import assert from "node:assert/strict";
import test from "node:test";
import { qualifiesForLongRest, sleepDeprivationDC } from "../../scripts/domain/sleep-rules.mjs";

test("long rest requires a successful sleep check, six hours, and less than an hour interruption", () => {
  assert.equal(qualifiesForLongRest({ sleepCheckSucceeded: true, sleepHours: 6, interruptionHours: 0.5 }), true);
  assert.equal(qualifiesForLongRest({ sleepCheckSucceeded: true, sleepHours: 5.5, interruptionHours: 0 }), false);
  assert.equal(qualifiesForLongRest({ sleepCheckSucceeded: true, sleepHours: 8, interruptionHours: 1 }), false);
  assert.equal(qualifiesForLongRest({ sleepCheckSucceeded: false, sleepHours: 8, interruptionHours: 0 }), false);
});

test("Xanathar sleep deprivation DC increases by five each missed rest", () => {
  assert.equal(sleepDeprivationDC(1), 10);
  assert.equal(sleepDeprivationDC(2), 15);
  assert.equal(sleepDeprivationDC(3), 20);
});
