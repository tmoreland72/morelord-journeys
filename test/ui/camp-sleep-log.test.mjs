import test from "node:test";
import assert from "node:assert/strict";
import { createJourney } from "../../scripts/domain/journey.mjs";
import { createRoute } from "../../scripts/domain/route.mjs";

globalThis.foundry = { applications: { api: { ApplicationV2: class { async _prepareContext() { return {}; } }, HandlebarsApplicationMixin: Base => Base } } };
const { JourneyApplication } = await import("../../scripts/apps/journey-app.mjs");

function journeyWithLog(log) {
  const route = createRoute({ id: "route", origin: { name: "A" }, destination: { name: "B" }, lengthSteps: 12 });
  return {
    ...createJourney({ id: "test", route }),
    routeSnapshot: route,
    remainingSteps: 9,
    progressSteps: 3,
    dayNumber: 1,
    phase: "dayComplete",
    travelers: [],
    log
  };
}

async function logResults(log) {
  const journey = journeyWithLog(log);
  globalThis.game = { user: { isGM: true }, settings: { get: () => journey }, i18n: { localize: key => key } };
  const context = await new JourneyApplication()._prepareContext({});
  return Object.fromEntries(context.recentLog.map(entry => [entry.data?.phase, entry.result]));
}

const watches = [{ actorUuid: "Actor.a" }, { actorUuid: "Actor.b" }, { actorUuid: "Actor.c" }, { actorUuid: "Actor.d" }];
const sleep = [{ actorUuid: "Actor.a" }, { actorUuid: "Actor.b" }, { actorUuid: "Actor.c" }];

test("camp logged before rest does not claim a rest-result count", async () => {
  const results = await logResults([
    { type: "phaseRecorded", dayNumber: 1, data: { phase: "camp", result: { watches, nightEncounterSkipped: false } } },
    { type: "phaseRecorded", dayNumber: 1, data: { phase: "sleep", result: { sleep } } }
  ]);
  assert.equal(results.camp, "4 watches");
  assert.equal(results.sleep, "3 rest results");
});

test("camp and sleep report the same rest-result count when camp recorded sleep", async () => {
  const results = await logResults([
    { type: "phaseRecorded", dayNumber: 1, data: { phase: "camp", result: { watches, sleep } } },
    { type: "phaseRecorded", dayNumber: 1, data: { phase: "sleep", result: { sleep } } }
  ]);
  assert.equal(results.camp, "4 watches; 3 rest results");
  assert.equal(results.sleep, "3 rest results");
});
