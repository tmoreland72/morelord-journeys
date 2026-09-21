import test from "node:test";
import assert from "node:assert/strict";
import { createJourney } from "../../scripts/domain/journey.mjs";
import { createRoute } from "../../scripts/domain/route.mjs";
import { adjustRemainingTravel, readyJourney } from "../../scripts/domain/engine.mjs";
import { getActiveJourney, saveActiveJourney } from "../../scripts/foundry/settings-repository.mjs";

test("remaining travel adjustments survive storage without rewriting earned progress", async () => {
  const original = globalThis.game;
  let stored = readyJourney(createJourney({ id: "journey", route: createRoute({ id: "route", origin: { name: "A" }, destination: { name: "B" }, lengthSteps: 16 }) }));
  stored.progressSteps = 4;
  stored.remainingSteps = 12;
  globalThis.game = { user: { isGM: false }, settings: { get: () => structuredClone(stored), set: async (m, k, value) => { stored = structuredClone(value); } } };
  try {
    for (const remaining of [5, 20, 0]) {
      const adjusted = adjustRemainingTravel(await getActiveJourney(), remaining);
      await saveActiveJourney(adjusted);
      const loaded = await getActiveJourney();
      assert.equal(loaded.remainingSteps, remaining);
      assert.equal(loaded.progressSteps, 4);
      assert.equal(loaded.routeSnapshot.lengthSteps, 16);
      assert.equal(loaded.status, remaining ? "ready" : "arrived");
    }
  } finally { globalThis.game = original; }
});
