import test from "node:test";
import assert from "node:assert/strict";
import { createNightEncounterInterruptions } from "../../scripts/domain/night-interruption-rules.mjs";

test("a night attack interrupts every traveler", () => {
  const travelers = [
    { actorUuid: "Actor.a", actorName: "A" },
    { actorUuid: "Actor.b", actorName: "B" },
    { actorUuid: "Actor.c", actorName: "C" }
  ];
  const result = createNightEncounterInterruptions(travelers, { outcome: "nightAttack", watchIndex: 2, recordedAt: 10 });
  assert.deepEqual(result.map(entry => entry.actorUuid), ["Actor.a", "Actor.b", "Actor.c"]);
  assert.ok(result.every(entry => entry.hours === 1 && entry.watchIndex === 2));
});

test("a minor night encounter interrupts every traveler but a quiet result does not", () => {
  const travelers = [{ actorUuid: "Actor.a", actorName: "A" }, { actorUuid: "Actor.b", actorName: "B" }];
  assert.equal(createNightEncounterInterruptions(travelers, { outcome: "minor" }).length, 2);
  assert.deepEqual(createNightEncounterInterruptions(travelers, { outcome: "uneventful" }), []);
});
