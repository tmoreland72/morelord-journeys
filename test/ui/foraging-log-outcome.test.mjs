import test from "node:test";
import assert from "node:assert/strict";
import { createJourney } from "../../scripts/domain/journey.mjs";
import { createRoute } from "../../scripts/domain/route.mjs";
import { formatForagingFoodSplit, formatForagingLogResult, formatForagingOutcomeText, resolveForagingResults } from "../../scripts/domain/foraging-rules.mjs";

globalThis.foundry = { applications: { api: { ApplicationV2: class { async _prepareContext() { return {}; } }, HandlebarsApplicationMixin: Base => Base } } };
const { JourneyApplication } = await import("../../scripts/apps/journey-app.mjs");

test("foraging log and outcome agree on found, pool, and excess food", async () => {
  const travelers = ["a", "b", "c"].map(id => ({ actorUuid: `Actor.${id}` }));
  const resolution = {
    ...resolveForagingResults(travelers, [
      { actorUuid: "Actor.a", succeeded: true, foodFound: 2 },
      { actorUuid: "Actor.b", succeeded: true, foodFound: 1 },
      { actorUuid: "Actor.c", succeeded: true, foodFound: 1 }
    ]),
    excessRationsAdded: [{ actorUuid: "Actor.a", quantity: 2 }]
  };
  const split = "Found 4 food: 3 to pool, 1 excess to foragers";
  assert.equal(resolution.totalFoodFound, 4);
  assert.equal(formatForagingFoodSplit(resolution), split);
  const outcome = formatForagingOutcomeText(resolution);
  const logged = formatForagingLogResult(resolution);
  assert.equal(outcome.startsWith(`${split};`), true);
  assert.equal(logged.startsWith(`${split};`), true);
  assert.equal(outcome.slice(0, split.length), logged.slice(0, split.length));
  assert.equal(outcome.includes("+2 food added"), false);
  assert.equal(logged.includes("4 food found"), false);

  const route = createRoute({ id: "route", origin: { name: "A" }, destination: { name: "B" }, lengthSteps: 12 });
  const journey = {
    ...createJourney({ id: "test", route }),
    routeSnapshot: route,
    remainingSteps: 9,
    progressSteps: 3,
    phase: "dayComplete",
    travelers: [],
    log: [{ type: "phaseRecorded", dayNumber: 0, data: { phase: "foraging", result: { resolution } } }]
  };
  globalThis.game = { user: { isGM: true }, settings: { get: () => journey }, i18n: { localize: key => key } };
  const context = await new JourneyApplication()._prepareContext({});
  const entry = context.recentLog.find(item => item.data?.phase === "foraging");
  assert.equal(entry.result.startsWith(`${split};`), true);
  assert.equal(entry.result.slice(0, split.length), outcome.slice(0, split.length));
});
