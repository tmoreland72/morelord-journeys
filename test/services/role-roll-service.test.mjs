import assert from "node:assert/strict";
import test from "node:test";
import { roleRollOutcome } from "../../scripts/services/role-roll-service.mjs";
import { navigationOutcomeLabel } from "../../scripts/domain/navigation-rules.mjs";

test("role roll outcomes apply phase-specific failure rules", () => {
  assert.equal(roleRollOutcome({ phase: "navigation", total: 15, dc: 15 }), "success");
  assert.equal(roleRollOutcome({ phase: "navigation", total: 12, dc: 15 }), "lost");
  assert.equal(roleRollOutcome({ phase: "navigation", total: 9, dc: 15 }), "lost");
  assert.equal(roleRollOutcome({ phase: "navigation", total: 25, dc: 15, natural: 1 }), "reversed");
  assert.equal(roleRollOutcome({ phase: "navigation", total: 8, dc: 15, natural: 20 }), "shortcut");
  assert.equal(roleRollOutcome({ phase: "discovery", total: 14, dc: 15 }), "failure");
  assert.equal(roleRollOutcome({ phase: "discovery", total: 15, dc: 15 }), "success");
});

test("automatic navigation failure is lost rather than reversed", () => {
  assert.equal(roleRollOutcome({ phase: "navigation", dc: 15, automatic: false }), "lost");
  assert.equal(roleRollOutcome({ phase: "navigation", dc: 15, automatic: true }), "success");
});

test("navigation outcomes are described as complete sentences", () => {
  assert.equal(navigationOutcomeLabel("success"), "The party stays on course and applies today’s travel progress.");
  assert.match(navigationOutcomeLabel("lost"), /no travel progress today\.$/);
  assert.match(navigationOutcomeLabel("reversed"), /one full day/);
  assert.match(navigationOutcomeLabel("shortcut"), /⅓ day\.$/);
});
