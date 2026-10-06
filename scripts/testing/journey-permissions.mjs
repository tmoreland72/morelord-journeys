import { assert } from '../../../morelord-core/scripts/testing/in-game.js';

export const journeyPermissionsCheck = {
  id: 'journeys.player-gm-access',
  async run() {
    assert(!game.user.isGM, 'Run this regression on a player client.');
    const api = game.modules.get('morelord-journeys').api;
    const prior = JSON.stringify(game.settings.get('morelord-journeys', 'activeJourney'));
    const tool = ui.controls.controls.tokens.tools.morelordJourneys;
    assert(!tool?.visible, 'Players must not see the Journeys toolbar button.');
    for (const action of [() => api.open(), () => api.repository.saveActiveJourney({}), () => api.repository.clearActiveJourney()]) {
      let rejected = false;
      try { await action(); } catch (error) { rejected = /Only the GM/.test(error.message); }
      assert(rejected, 'Player GM operations must reject before touching journey state.');
    }
    const app = new api.applications.JourneyApplication();
    try {
      await app.render({ force: true });
      assert(!app.rendered, 'Direct application rendering must not expose the GM dashboard.');
    } finally { await app.close(); }
    const { SavedJourneyManager } = await import("../apps/saved-journey-manager.mjs");
    const manager = new SavedJourneyManager();
    try {
      await manager.render({ force: true });
      assert(!manager.rendered, "Players must not open the saved-journey manager directly.");
    } finally { await manager.close(); }
    assert(JSON.stringify(game.settings.get('morelord-journeys', 'activeJourney')) === prior, 'The active journey must remain unchanged.');
  }
};
export const journeyGMPermissionsCheck = {
  id: 'journeys.gm-dashboard-access',
  async run() {
    assert(game.user.isGM, 'Run this regression on a GM client.');
    const api = game.modules.get('morelord-journeys').api;
    const prior = JSON.stringify(game.settings.get('morelord-journeys', 'activeJourney'));
    const undo = structuredClone(game.settings.get('morelord-journeys', 'journeyUndo'));
    assert(ui.controls.controls.tokens.tools.morelordJourneys?.visible, 'GMs must retain the Journeys toolbar button.');
    const app = new api.applications.JourneyApplication();
    try {
      await app.render({ force: true });
      assert(app.rendered && app.element.querySelector('.ml-page-body'), 'The GM dashboard must render with Core layout.');
      assert(JSON.stringify(game.settings.get('morelord-journeys', 'activeJourney')) === prior, 'Rendering must not change the active journey.');
    } finally {
      await app.close();
      if (JSON.stringify(game.settings.get('morelord-journeys', 'journeyUndo')) !== JSON.stringify(undo)) {
        await game.settings.set('morelord-journeys', 'journeyUndo', undo);
      }
    }
  }
};
