import assert from "node:assert/strict";
import test from "node:test";
import { automaticDayEncounterModifiers, resolveEncounterRoll } from "../../scripts/domain/encounter-rules.mjs";

test("danger shifts daytime encounters toward major results", () => {
  assert.equal(resolveEncounterRoll({ raw: 70, danger: 1 }).outcome, "minor");
  assert.equal(resolveEncounterRoll({ raw: 70, danger: 5 }).outcome, "major");
});

test("night encounter bands include peaceful rest and night attacks", () => {
  assert.equal(resolveEncounterRoll({ raw: 25, danger: 1, night: true }).outcome, "peacefulRest");
  assert.equal(resolveEncounterRoll({ raw: 80, danger: 3, night: true }).outcome, "nightAttack");
});

test("all known situational modifiers are applied", () => {
  const result = resolveEncounterRoll({ raw: 50, danger: 1, modifiers: [{ value: 5 }, { value: -5 }, { value: 100 }] });
  assert.equal(result.modified, 150);
});

test("day encounter modifiers are derived from weather, pace, and route", () => {
  const modifiers = automaticDayEncounterModifiers({
    routeSnapshot: { danger: 1, traffic: "high" },
    currentDay: { pace: "slow", phases: { weather: { generated: { label: "Thunderstorm" }, extreme: true } } }
  });
  assert.deepEqual(modifiers.map(item => item.id), ["badWeather", "stealthy", "road"]);
});
