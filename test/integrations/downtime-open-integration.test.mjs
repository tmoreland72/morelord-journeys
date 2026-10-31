import assert from "node:assert/strict";
import test from "node:test";
import { DowntimeOpenIntegration } from "../../scripts/integrations/downtime-open-integration.mjs";

test("Downtime integration is unavailable when the module is absent or inactive", () => {
  globalThis.game = { modules: new Map(), user: { isGM: true } };
  globalThis.MorelordDowntime = { open() { throw new Error("inactive global must not be used"); } };
  const integration = new DowntimeOpenIntegration();
  assert.equal(integration.isAvailable(), false);
  assert.deepEqual(integration.snapshot(), {
    available: false,
    moduleId: "morelord-downtime",
    active: false
  });

  game.modules.set("morelord-downtime", { active: false, api: { open() {} } });
  assert.equal(integration.isAvailable(), false);
  assert.equal(integration.snapshot().active, false);

  game.modules.set("morelord-downtime", { active: true, api: {} });
  assert.equal(integration.isAvailable(), false);

  delete globalThis.MorelordDowntime;
  delete globalThis.game;
});

test("Downtime integration opens the dashboard through the public open API", async () => {
  let opened = 0;
  const api = {
    openDashboard() { throw new Error("Downtime has no openDashboard method."); },
    open: async function open() {
      opened += 1;
      assert.equal(this, api);
      return "dashboard";
    }
  };
  globalThis.game = {
    modules: new Map([["morelord-downtime", { active: true, api }]]),
    user: { isGM: true }
  };

  const integration = new DowntimeOpenIntegration();
  assert.equal(integration.isAvailable(), true);
  assert.equal(await integration.open(), "dashboard");
  assert.equal(opened, 1);
  assert.equal(integration.snapshot().available, true);

  game.modules.set("morelord-downtime", { active: true });
  globalThis.MorelordDowntime = { async open() { opened += 1; } };
  await integration.open();
  assert.equal(opened, 2);

  game.user.isGM = false;
  await assert.rejects(integration.open(), /Only the GM can open Morelord Downtime/);
  assert.equal(opened, 2);

  delete globalThis.MorelordDowntime;
  delete globalThis.game;
});
