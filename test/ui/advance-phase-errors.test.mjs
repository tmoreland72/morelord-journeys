import test from "node:test";
import assert from "node:assert/strict";
import { createJourney } from "../../scripts/domain/journey.mjs";
import { createRoute } from "../../scripts/domain/route.mjs";

globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: Base => Base } } };
const { JourneyApplication } = await import("../../scripts/apps/journey-app.mjs");

test("Resolve and Continue reports pending Perception without masking it or duplicating telemetry", async () => {
  const journey = { ...createJourney({ id: "test", route: createRoute({ id: "route", origin: { name: "A" }, destination: { name: "B" }, lengthSteps: 12 }) }), status: "active", phase: "camp", currentDay: { campWatches: [], nightEncounterCheck: { method: "nightDice", encounters: [] }, pendingCampPerceptionRolls: [{}] } };
  globalThis.game = { user: { isGM: true }, settings: { get: () => journey } };
  const notices = [], reports = [];
  globalThis.ui = { notifications: { error: message => notices.push(message) } };
  globalThis.MorelordCore = { telemetry: { error: (...args) => reports.push(args) } };
  const app = new JourneyApplication();
  app.element = { querySelector: () => null };
  const previous = console.error;
  console.error = () => {};
  try { await JourneyApplication.advancePhase.call(app); }
  finally { console.error = previous; }
  assert.deepEqual(notices, ["Resolve pending watch Perception checks before continuing."]);
  assert.equal(reports.length, 1);
  assert.equal(reports[0][0], "morelord-journeys");
});
