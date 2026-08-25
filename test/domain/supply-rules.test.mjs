import assert from "node:assert/strict";
import test from "node:test";
import { hungerSaveDC, hungerThreshold } from "../../scripts/domain/supply-rules.mjs";

test("hunger allows three plus Constitution modifier days without a save", () => {
  assert.equal(hungerThreshold(2), 5);
  assert.equal(hungerSaveDC(5, 2), null);
  assert.equal(hungerSaveDC(6, 2), 10);
});

test("hunger save DC increases by five each additional hungry day", () => {
  assert.equal(hungerSaveDC(4, 0), 10);
  assert.equal(hungerSaveDC(5, 0), 15);
  assert.equal(hungerSaveDC(6, 0), 20);
});

test("negative Constitution modifiers reduce the hunger grace period", () => {
  assert.equal(hungerThreshold(-2), 1);
  assert.equal(hungerSaveDC(2, -2), 10);
});
