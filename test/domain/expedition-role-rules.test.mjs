import test from "node:test";
import assert from "node:assert/strict";
import { validateExpeditionRoles } from "../../scripts/domain/expedition-role-rules.mjs";

test("navigator and observer must be different characters", () => {
  assert.throws(() => validateExpeditionRoles({ navigatorUuid: "Actor.one", observerUuid: "Actor.one" }), /different characters/);
  assert.deepEqual(validateExpeditionRoles({ navigatorUuid: "Actor.one", observerUuid: "Actor.two" }), { navigatorUuid: "Actor.one", observerUuid: "Actor.two" });
});
