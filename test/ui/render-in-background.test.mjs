import test from "node:test";
import assert from "node:assert/strict";
import { renderJourneyInBackground } from "../../scripts/ui/render-in-background.mjs";

test("open journey windows refresh through Core without raising themselves", async () => {
  const calls = [];
  const application = {
    rendered: true,
    render: async options => { calls.push(options); return application; }
  };
  const renderInBackground = async app => { calls.push(["core", app]); return app; };
  globalThis.game = { modules: new Map([["morelord-core", { api: { ui: { renderInBackground } } }]]) };
  try {
    await renderJourneyInBackground(application);
    assert.deepEqual(calls, [["core", application]]);
    game.modules.get("morelord-core").api.ui.renderInBackground = null;
    await renderJourneyInBackground(application);
    assert.deepEqual(calls.at(-1), { force: false });
    application.rendered = false;
    const before = calls.length;
    await renderJourneyInBackground(application);
    assert.equal(calls.length, before);
  } finally {
    delete globalThis.game;
  }
});
