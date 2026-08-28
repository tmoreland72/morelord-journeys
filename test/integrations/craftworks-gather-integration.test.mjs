import assert from "node:assert/strict";
import test from "node:test";
import { CraftworksGatherIntegration } from "../../scripts/integrations/craftworks-gather-integration.mjs";

test("Craftworks integration is unavailable when the module is absent", () => {
  globalThis.game = { modules: new Map(), user: { isGM: true } };
  const integration = new CraftworksGatherIntegration();
  assert.equal(integration.isAvailable(), false);
  assert.deepEqual(integration.snapshot(), {
    available: false,
    moduleId: "morelord-craftworks",
    active: false
  });
  delete globalThis.game;
});

test("Craftworks integration launches the main public application", async () => {
  let opened = 0;
  const api = {
    open: async () => { opened += 1; }
  };
  globalThis.game = {
    modules: new Map([["morelord-craftworks", { active: true, api }]]),
    user: { isGM: true }
  };
  globalThis.canvas = { scene: { id: "scene", name: "Forest" } };

  const integration = new CraftworksGatherIntegration();
  assert.equal(integration.isAvailable(), true);
  await integration.open();
  assert.equal(opened, 1);
  assert.equal(integration.snapshot().sceneName, "Forest");

  delete globalThis.canvas;
  delete globalThis.game;
});
