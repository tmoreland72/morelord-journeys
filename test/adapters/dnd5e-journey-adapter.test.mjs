import assert from "node:assert/strict";
import test from "node:test";
import { Dnd5eJourneyAdapter } from "../../scripts/adapters/dnd5e-journey-adapter.mjs";

test("navigation failures are lost unless the d20 is a natural 1", async () => {
  const actor = {
    name: "Guide",
    rollSkill: async () => ({ total: 9 })
  };
  globalThis.fromUuid = async () => actor;
  const adapter = new Dnd5eJourneyAdapter();
  const result = await adapter.rollNavigation({
    roles: { navigatorUuid: "Actor.guide" },
    routeSnapshot: { name: "Wild Trail", navigationDC: 15 }
  });
  assert.equal(result.outcome, "lost");
  assert.equal(result.total, 9);
  delete globalThis.fromUuid;
});

test("navigation treats a route without a DC as automatic success", async () => {
  globalThis.fromUuid = async () => ({ name: "Guide", rollSkill: async () => null });
  const result = await new Dnd5eJourneyAdapter().rollNavigation({
    roles: { navigatorUuid: "Actor.guide" },
    routeSnapshot: { name: "High Road", navigationDC: null }
  });
  assert.equal(result.outcome, "success");
  assert.equal(result.total, null);
  delete globalThis.fromUuid;
});

test("navigation uses the natural d20 for Turned Around and Shortcut", async () => {
  const adapter = new Dnd5eJourneyAdapter();
  const actor = { name: "Guide", rollSkill: async () => ({ total: 25, dice: [{ faces: 20, results: [{ result: 1, active: true }] }] }) };
  globalThis.fromUuid = async () => actor;
  const journey = { roles: { navigatorUuid: "Actor.guide" }, routeSnapshot: { name: "Wild Trail", navigationDC: 15 } };
  assert.equal((await adapter.rollNavigation(journey)).outcome, "reversed");
  actor.rollSkill = async () => ({ total: 8, dice: [{ faces: 20, results: [{ result: 20, active: true }] }] });
  assert.equal((await adapter.rollNavigation(journey)).outcome, "shortcut");
  delete globalThis.fromUuid;
});
