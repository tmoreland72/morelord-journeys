import test from "node:test";
import assert from "node:assert/strict";
import { naturalD20 } from "../../scripts/domain/d20-roll.mjs";

test("natural d20 reads the active result from advantage and disadvantage rolls", () => {
  assert.equal(naturalD20({ dice: [{ faces: 20, results: [{ result: 1, active: false }, { result: 20, active: true }] }] }), 20);
  assert.equal(naturalD20({ dice: [{ faces: 20, results: [{ result: 1, active: true }, { result: 20, discarded: true }] }] }), 1);
});
