import test from "node:test";
import assert from "node:assert/strict";
import { phaseSkipReason } from "../../scripts/domain/phase-rules.mjs";

test("stopped travel skips encounters, discovery, navigation, and press on but not camp", () => {
  assert.match(phaseSkipReason({ phase: "encounters", pace: "stopped" }), /Stopped/);
  assert.match(phaseSkipReason({ phase: "discovery", pace: "stopped" }), /Stopped/);
  assert.match(phaseSkipReason({ phase: "navigation", pace: "stopped" }), /Stopped/);
  assert.match(phaseSkipReason({ phase: "pressOn", pace: "stopped" }), /Stopped/);
  assert.equal(phaseSkipReason({ phase: "camp", pace: "stopped" }), null);
});
