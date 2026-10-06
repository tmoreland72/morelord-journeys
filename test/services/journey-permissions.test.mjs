import test from 'node:test';
import assert from 'node:assert/strict';
import { saveActiveJourney, clearActiveJourney } from '../../scripts/foundry/settings-repository.mjs';

test('players cannot save or clear journeys, even through the repository API', async () => {
  const prior = globalThis.game;
  let touched = false;
  globalThis.game = { user: { isGM: false }, settings: { get() { touched = true; }, set() { touched = true; } } };
  try {
    await assert.rejects(saveActiveJourney({}), /Only the GM/);
    await assert.rejects(clearActiveJourney(), /Only the GM/);
    assert.equal(touched, false);
  } finally { globalThis.game = prior; }
});
