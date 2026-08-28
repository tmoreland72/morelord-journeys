import assert from "node:assert/strict";
import test from "node:test";
import { longRestFailureReasons, qualifiesForLongRest, sleepDeprivationDC } from "../../scripts/domain/sleep-rules.mjs";

test("long rest requires a successful sleep check, six hours, and less than an hour interruption", () => {
  assert.equal(qualifiesForLongRest({ sleepCheckSucceeded: true, sleepHours: 6, interruptionHours: 0.5 }), true);
  assert.equal(qualifiesForLongRest({ sleepCheckSucceeded: true, sleepHours: 5.5, interruptionHours: 0 }), false);
  assert.equal(qualifiesForLongRest({ sleepCheckSucceeded: true, sleepHours: 8, interruptionHours: 1 }), false);
  assert.equal(qualifiesForLongRest({ sleepCheckSucceeded: false, sleepHours: 8, interruptionHours: 0 }), false);
  assert.equal(qualifiesForLongRest({ sleepCheckSucceeded: true, sleepHours: 4, requiredSleepHours: 4, interruptionHours: 0 }), true);
});

test("Xanathar sleep deprivation DC increases by five each missed rest", () => {
  assert.equal(sleepDeprivationDC(1), 10);
  assert.equal(sleepDeprivationDC(2), 15);
  assert.equal(sleepDeprivationDC(3), 20);
});

test("sleep deprivation accepts configured starting and escalation DCs", () => {
  assert.equal(sleepDeprivationDC(1, { base: 8, increase: 3 }), 8);
  assert.equal(sleepDeprivationDC(3, { base: 8, increase: 3 }), 14);
});

test("long rest failure reasons distinguish a passed check from other unmet requirements", () => {
  assert.deepEqual(longRestFailureReasons({ sleepCheckSucceeded: true, sleepHours: 6, interruptionHours: 1 }), [
    "1 interrupted hour was recorded; interruption must be less than 1 hour"
  ]);
  assert.deepEqual(longRestFailureReasons({ sleepCheckSucceeded: false, sleepHours: 5, interruptionHours: 0 }), [
    "the sleep check failed",
    "only 5 sleep hours were completed; at least 6 are required"
  ]);
  assert.deepEqual(longRestFailureReasons({ sleepCheckSucceeded: true, sleepHours: 3, requiredSleepHours: 4, interruptionHours: 0 }), [
    "only 3 sleep hours were completed; at least 4 are required"
  ]);
});
