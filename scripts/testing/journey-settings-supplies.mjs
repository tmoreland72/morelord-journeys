import { runInGameTests, assert } from "../../../morelord-core/scripts/testing/in-game.js";
import { JourneySettingsApplication } from "../apps/journey-settings-app.mjs";
import { getNightCheckInterval } from "../core/journey-settings.mjs";

// Supply check changes the prepared disposable journey and its inventories.
export async function runJourneySettingsSuppliesTests() {
  return runInGameTests({ checks: [{
    id: "journeys.night-settings-render",
    async run() {
      assert(game.user.isGM, "Run on the GM client.");
      const app = new JourneySettingsApplication();
      try {
        await app.render({ force: true });
        const input = app.element.querySelector('[name="nightCheckIntervalHours"]');
        assert(input && Number(input.value) === getNightCheckInterval(), "Night frequency must display its saved value.");
        assert(input.closest(".ml-setting-row"), "Frequency must use a Core setting row.");
        assert(!app.element.querySelector('[name="dayEncounterDie"], [name="night-peacefulMax"]'), "Obsolete die and d100 settings must not appear.");
      } finally { await app.close(); }
    }
  }, {
    id: "journeys.continue-applies-supplies",
    async run() {
      assert(game.user.isGM, "Run on the GM client.");
      const api = game.modules.get("morelord-journeys").api;
      const before = await api.repository.getActiveJourney();
      assert(before?.phase === "foraging" && before.currentDay?.foragingResolution && !before.currentDay.supplyResolution, "Prepare a disposable journey with completed foraging and unconsumed supplies.");
      const app = new api.applications.JourneyApplication();
      try {
        await app.render({ force: true });
        assert(!app.element.querySelector('[data-action="consumeTravelSupplies"]'), "There must be no separate consumption button.");
        const button = app.element.querySelector('[data-action="advancePhase"]');
        assert(button && !button.disabled, "Continue must be available after foraging.");
        button.click();
        let after;
        const deadline = Date.now() + 15000;
        do {
          await new Promise(resolve => setTimeout(resolve, 100));
          after = await api.repository.getActiveJourney();
        } while (Date.now() < deadline && after.phase === "foraging" && !after.currentDay?.pendingSupplySaves?.length);
        assert(after.currentDay?.supplyResolution, "Continue must save supply consumption.");
        assert(after.phase !== "foraging" || after.currentDay?.pendingSupplySaves?.length > 0, "Continue must advance unless a shortage save is pending.");
        const saved = JSON.stringify(after.currentDay.supplyResolution);
        await app.render({ force: true });
        assert(JSON.stringify((await api.repository.getActiveJourney()).currentDay.supplyResolution) === saved, "Re-rendering must not consume again.");
      } finally { await app.close(); }
    }
  }] });
}
