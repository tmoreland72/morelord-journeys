import test from "node:test";
import assert from "node:assert/strict";

test("exploration callout waits for every forager and no pending requests", async () => {
  globalThis.foundry = { applications: { api: { ApplicationV2: class { async _onRender() {} }, HandlebarsApplicationMixin: cls => cls } } };
  globalThis.document = { createElement: () => ({ dataset: {}, classList: { add() {} }, append() {} }) };
  try {
    const { JourneyApplication } = await import("../../scripts/apps/journey-dashboard-app.mjs");
    const app = new JourneyApplication();
    let shown = 0;
    app.element = { querySelector: () => ({ before: () => shown++ }) };
    const context = { hasJourney: true, phaseIs: { foraging: true }, craftworksGather: { available: true }, journey: { travelers: [{ actorUuid: "A" }, { actorUuid: "B" }], currentDay: {} } };
    for (const [day, expected] of [
      [{}, 0],
      [{ foragingResults: [{ actorUuid: "A" }], pendingForagingRolls: [{ actorUuid: "B" }] }, 0],
      [{ foragingResults: [{ actorUuid: "A" }, { actorUuid: "A" }] }, 0],
      [{ foragingResults: [{ actorUuid: "A" }, { actorUuid: "B" }], pendingForagingRolls: [{ actorUuid: "B" }] }, 0],
      [{ foragingResults: [{ actorUuid: "A", succeeded: false }, { actorUuid: "B", automatic: true }] }, 1]
    ]) {
      shown = 0;
      context.journey.currentDay = day;
      await app._onRender(context, {});
      assert.equal(shown, expected);
    }
  } finally {
    delete globalThis.foundry;
    delete globalThis.document;
  }
});
