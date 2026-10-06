import test from 'node:test';
import assert from 'node:assert/strict';
import { rejectNightEncounter } from '../../scripts/domain/reject-night-encounter.mjs';
test('reject removes only its encounter and interruption; shared watch request remains until last encounter', () => {
  const journey = { phase: 'camp', currentDay: { nightEncounterCheck: { encounters: [{ id: 'a', watchIndex: 1 }, { id: 'b', watchIndex: 1 }], encounterCount: 2, results: [1, 1] }, sleepInterruptions: [{ encounterId: 'a' }, { encounterId: 'b' }], pendingCampPerceptionRolls: [{ id: 'roll', watchIndex: 1 }] } };
  assert.equal(rejectNightEncounter(journey, 'a').length, 0);
  assert.equal(journey.currentDay.nightEncounterCheck.encounterCount, 1);
  assert.deepEqual(journey.currentDay.sleepInterruptions, [{ encounterId: 'b' }]);
  assert.equal(rejectNightEncounter(journey, 'b')[0].id, 'roll');
  assert.equal(journey.currentDay.pendingCampPerceptionRolls.length, 0);
  assert.deepEqual(journey.currentDay.nightEncounterCheck.results, [1, 1]);
  assert.equal(rejectNightEncounter(journey, 'b').length, 0);
  assert.equal(journey.currentDay.nightEncounterCheck.rejectedEncounters.length, 2);
});
