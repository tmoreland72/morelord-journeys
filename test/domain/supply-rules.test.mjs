import assert from "node:assert/strict";
import test from "node:test";
import { hungerSaveDC, hungerThreshold } from "../../scripts/domain/supply-rules.mjs";
test("daily saves stop at day five regardless of Constitution", () => {
  for (const con of [-2, 0, 2, 5]) {
    assert.equal(hungerThreshold(con), 5);
    for (const day of [1, 2, 3, 4]) assert.equal(hungerSaveDC(day, con), 10);
    for (const day of [5, 6, 10]) assert.equal(hungerSaveDC(day, con), null);
  }
});
