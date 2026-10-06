import test from 'node:test';
import assert from 'node:assert/strict';
import { readNightInterruptions } from '../../scripts/ui/night-interruption-controls.mjs';

test('two encounters derive two events per traveler and their rolled timing', () => {
  const journey = { travelers: [{ actorUuid: 'a', name: 'A' }, { actorUuid: 'b', name: 'B' }], currentDay: { nightEncounterCheck: { encounters: [{ id: 'first', watchIndex: 0, startHour: 0 }, { id: 'second', watchIndex: 2, startHour: 5 }] } } };
  const root = { querySelector: selector => ({ querySelector: () => ({ value: selector.includes('first') ? '0' : '2' }) }) };
  const results = readNightInterruptions(root, journey);
  for (const actorUuid of ['a', 'b']) {
    const events = results.filter(entry => entry.actorUuid === actorUuid);
    assert.equal(events.reduce((sum, entry) => sum + entry.count, 0), 2);
    assert.deepEqual(events.map(entry => entry.startHour), [0, 5]);
    assert.deepEqual(events.map(entry => entry.hours), [1, 2]);
    assert.ok(events.every(entry => entry.interruptsRest && entry.offsetHours === 0));
  }
  assert.ok(readNightInterruptions({ querySelector: () => null }, journey).every(entry => entry.hours === 1));
});
