import { runInGameTests, assert } from "../../../morelord-core/scripts/testing/in-game.js";
import { UNDO_SETTING, requestGoBack } from "../services/journey-undo-service.mjs";

// Mutates only a user-prepared disposable journey and its journaled documents.
export async function runJourneyGoBackTests() {
  return runInGameTests({ checks: [{
    id: "journeys.go-back-restores-checkpoint",
    async run() {
      assert(game.user.isGM, "Run on the GM client.");
      const api = game.modules.get("morelord-journeys").api;
      const history = structuredClone(game.settings.get("morelord-journeys", UNDO_SETTING));
      assert(history?.checkpoints?.length > 1, "Prepare a disposable journey and advance at least one step.");
      const target = history.checkpoints.at(-2).journey;
      const app = new api.applications.JourneyApplication();
      try {
        await app.render({ force: true });
        const button = app.element.querySelector('[data-action="goBack"]');
        assert(button && !button.disabled, "The GM must have a Go Back control.");
        await requestGoBack();
        const restored = await api.repository.getActiveJourney();
        assert(restored.phase === target.phase && restored.dayNumber === target.dayNumber, "Go Back must reopen the prior checkpoint.");
        assert(restored.remainingSteps === target.remainingSteps, "Remaining travel must be restored.");
        assert(JSON.stringify(restored.currentDay) === JSON.stringify(target.currentDay), "Phase calculations and pending requests must match the checkpoint.");
        await app.render({ force: true });
      } finally { await app.close(); }
    }
  }] });
}
