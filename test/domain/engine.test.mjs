import assert from "node:assert/strict";
import test from "node:test";
import { TRAVEL_PHASES } from "../../scripts/domain/constants.mjs";
import {
  addProgressModifier,
  beginTravelDay,
  completeTravelDay,
  readyJourney,
  recordPhase
} from "../../scripts/domain/engine.mjs";
import { createJourney } from "../../scripts/domain/journey.mjs";
import { createRoute } from "../../scripts/domain/route.mjs";

function makeJourney(lengthSteps = 12) {
  const route = createRoute({
    id: "forest-edge",
    name: "Forest Edge",
    origin: { name: "Northwatch" },
    destination: { name: "Old Keep" },
    lengthSteps,
    danger: 2,
    discoveryDC: 20,
    resourcesDC: 15,
    navigationDC: 10
  });
  return createJourney({ id: "expedition", name: "To the Old Keep", route });
}

function resolveDay(source, { pace = "normal", navigation = "success" } = {}) {
  let current = beginTravelDay(source);
  for (const phase of TRAVEL_PHASES.slice(0, -1)) {
    const result = phase === "pace" ? { pace }
      : phase === "navigation" ? { outcome: navigation }
        : {};
    current = recordPhase(current, phase, result);
  }
  return completeTravelDay(current);
}

test("normal travel advances three steps", () => {
  const result = resolveDay(readyJourney(makeJourney()));
  assert.equal(result.progressSteps, 3);
  assert.equal(result.dayNumber, 1);
});

test("weather delay subtracts exactly one third from fast progress", () => {
  let current = beginTravelDay(readyJourney(makeJourney()));
  current = recordPhase(current, "weather", {});
  current = recordPhase(current, "pace", { pace: "fast" });
  current = addProgressModifier(current, { id: "storm", label: "Extreme weather", steps: -1 });
  for (const phase of TRAVEL_PHASES.slice(2, -1)) {
    current = recordPhase(current, phase, phase === "navigation" ? { outcome: "success" } : {});
  }
  const completed = completeTravelDay(current);
  assert.equal(completed.progressSteps, 3);
  assert.equal(completed.remainingSteps, 9);
});

test("failed navigation applies no route progress", () => {
  const result = resolveDay(readyJourney(makeJourney()), { pace: "fast", navigation: "lost" });
  assert.equal(result.progressSteps, 0);
  assert.equal(result.remainingSteps, 12);
});

test("pressing on still advances one third when navigation is lost", () => {
  let current = beginTravelDay(readyJourney(makeJourney()));
  for (const phase of TRAVEL_PHASES.slice(0, -1)) {
    const result = phase === "pace" ? { pace: "normal" } : phase === "navigation" ? { outcome: "lost" } : {};
    current = recordPhase(current, phase, result);
    if (phase === "pressOn") current = addProgressModifier(current, { id: "press-on", label: "Pressed on", steps: 1 });
  }
  const completed = completeTravelDay(current);
  assert.equal(completed.progressSteps, 1);
  assert.equal(completed.remainingSteps, 11);
});

test("turned-around navigation adds exactly one day to distance remaining", () => {
  const result = resolveDay(readyJourney(makeJourney()), { pace: "fast", navigation: "reversed" });
  assert.equal(result.progressSteps, 0);
  assert.equal(result.remainingSteps, 15);
});

test("a navigation shortcut advances one additional third day", () => {
  const result = resolveDay(readyJourney(makeJourney()), { pace: "normal", navigation: "shortcut" });
  assert.equal(result.progressSteps, 4);
  assert.equal(result.remainingSteps, 8);
});

test("arrival clamps progress to the route length", () => {
  const result = resolveDay(readyJourney(makeJourney(2)));
  assert.equal(result.progressSteps, 2);
  assert.equal(result.status, "arrived");
});

test("camp watch order and sleep choices carry into the next day", () => {
  let current = beginTravelDay(readyJourney(makeJourney()));
  current.currentDay.campWatches = [{ index: 0, actorUuid: "Actor.a", action: "Take a Watch" }];
  current.currentDay.campSleepPlan = { entries: [{ actorUuid: "Actor.a", equipment: { tent: true } }], coldWeather: true };
  for (const phase of TRAVEL_PHASES.slice(0, -1)) {
    const result = phase === "pace" ? { pace: "normal" } : phase === "navigation" ? { outcome: "success" } : {};
    current = recordPhase(current, phase, result);
  }
  const next = beginTravelDay(completeTravelDay(current));
  assert.equal(next.currentDay.campWatches[0].actorUuid, "Actor.a");
  assert.equal(next.currentDay.campWatches[0].action, "Take a Watch");
  assert.equal(next.currentDay.campSleepPlan.entries[0].equipment.tent, true);
});

test("unnamed routes and journeys derive their identity from endpoints", () => {
  const route = createRoute({ id: "route", origin: { name: "Northwatch" }, destination: { name: "Old Keep" }, lengthSteps: 3 });
  assert.equal(route.name, "Northwatch → Old Keep");
  assert.equal(createJourney({ id: "journey", route }).name, "Northwatch → Old Keep");
  assert.equal(createJourney({ id: "legacy", name: "Existing name", route }).name, "Existing name");
  assert.equal(createRoute({ ...route, name: "Existing route" }).name, "Existing route");
});
test("daily route ratings are applied at day start and earlier ratings stay in the log", () => {
  const ready = readyJourney(makeJourney(30));
  const ratings = { danger: 4, discoveryDC: 20, resourcesDC: 25, navigationDC: 15 };
  const first = beginTravelDay(ready, ratings);
  assert.deepEqual(first.currentDay.routeRatings, ratings);
  assert.equal(first.routeSnapshot.resourcesDC, 25);
  assert.equal(ready.routeSnapshot.danger, 2);
  assert.throws(() => beginTravelDay(first, { ...ratings, danger: 1 }), /Complete the current/);
  assert.throws(() => beginTravelDay(ready, { ...ratings, danger: 6 }), /Invalid daily/);
  let completed = first;
  for (const phase of TRAVEL_PHASES.slice(0, -1)) {
    completed = recordPhase(completed, phase, phase === "pace" ? { pace: "normal" } : phase === "navigation" ? { outcome: "success" } : {});
  }
  completed = completeTravelDay(completed);
  const second = beginTravelDay(completed, { ...ratings, danger: 1 });
  assert.equal(second.routeSnapshot.danger, 1);
  assert.equal(second.log.filter(entry => entry.type === "dayStarted")[0].data.routeRatings.danger, 4);
});
