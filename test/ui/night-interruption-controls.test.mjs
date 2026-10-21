import test from 'node:test';
import assert from 'node:assert/strict';
import { clampEncounterDuration, readNightInterruptions } from '../../scripts/ui/night-interruption-controls.mjs';

test('two encounters derive two events per traveler and their rolled timing', () => {
  const journey = { travelers: [{ actorUuid: 'a', name: 'A' }, { actorUuid: 'b', name: 'B' }], currentDay: { nightEncounterCheck: { encounters: [{ id: 'first', watchIndex: 0, startHour: 0 }, { id: 'second', watchIndex: 2, startHour: 5 }] } } };
  const root = { querySelector: selector => ({ querySelector: () => ({ value: selector.includes('first') ? '0' : '2' }) }) };
  const results = readNightInterruptions(root, journey);
  for (const actorUuid of ['a', 'b']) {
    const events = results.filter(entry => entry.actorUuid === actorUuid);
    assert.equal(events.reduce((sum, entry) => sum + entry.count, 0), 1);
    assert.deepEqual(events.map(entry => entry.startHour), [0, 5]);
    assert.deepEqual(events.map(entry => entry.hours), [0, 2]);
    assert.deepEqual(events.map(entry => entry.interruptsRest), [false, true]);
    assert.ok(events.every(entry => entry.offsetHours === 0));
  }
  assert.ok(readNightInterruptions({ querySelector: () => null }, journey).every(entry => entry.hours === 1 && entry.interruptsRest && entry.count === 1));
});

test('saved zero hours stays zero and one through eight hours still interrupt', () => {
  assert.equal(clampEncounterDuration(0, 1), 0);
  assert.equal(clampEncounterDuration('0', 1), 0);
  assert.equal(clampEncounterDuration(undefined, 1), 1);
  assert.equal(clampEncounterDuration('', 1), 1);
  assert.equal(clampEncounterDuration(1, 1), 1);
  assert.equal(clampEncounterDuration(8, 1), 8);
  assert.equal(clampEncounterDuration(9, 1), 8);
  assert.throws(() => clampEncounterDuration('nope', 1), /valid encounter duration/);
  const journey = { travelers: [{ actorUuid: 'a', name: 'A' }], currentDay: { nightEncounterCheck: { encounters: [{ id: 'zero', watchIndex: 1, startHour: 2 }, { id: 'one', watchIndex: 2, startHour: 4 }, { id: 'eight', watchIndex: 3, startHour: 6 }] }, sleepInterruptions: [{ encounterId: 'zero', hours: 0 }, { encounterId: 'one', hours: 1 }, { encounterId: 'eight', hours: 9 }] } };
  const saved = readNightInterruptions({ querySelector: () => null }, journey);
  assert.deepEqual(saved.map(entry => entry.hours), [0, 1, 8]);
  assert.deepEqual(saved.map(entry => entry.interruptsRest), [false, true, true]);
  assert.deepEqual(saved.map(entry => entry.count), [0, 1, 1]);
});
