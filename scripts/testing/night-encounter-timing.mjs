import { runInGameTests, assert } from "../../../morelord-core/scripts/testing/in-game.js";

// Run after rolling a night encounter in a disposable camp journey. No character or inventory changes; rendering may initialize undo history.
export async function runNightEncounterTimingTests() {
  return runInGameTests({ checks: [{
    id: "journeys.night-encounter-timing",
    async run() {
      assert(game.user.isGM, "Run this check on the GM client.");
      const api = game.modules.get("morelord-journeys")?.api;
      const journey = await api?.repository.getActiveJourney();
      const night = journey?.currentDay?.nightEncounterCheck;
      assert(journey?.phase === "camp" && ["minor", "nightAttack", "encounter"].includes(night?.outcome), "Prepare a camp with at least one surviving night encounter first.");
      const first = night.encounters?.[0] ?? night;
      const index = first.watchIndex;
      assert(Number.isInteger(index) && index >= 0 && index < 4, "The encounter must have an affected watch.");
      const expected = `Watch ${index + 1} (${first.startHour ?? index * 2}–${first.endHour ?? index * 2 + 2} hours after camp begins)`;
      const app = new api.applications.JourneyApplication();
      try {
        await app.render({ force: true });
        const notice = app.element.querySelector(".ml-journeys-night-timing");
        assert(notice && notice.getClientRects().length > 0, "Encounter timing must be visible without expanding Outcome Details.");
        assert(notice.textContent.includes(expected), "The notice must show the saved watch and hours from camp start.");
        assert(notice.parentElement.firstElementChild === notice, "Timing must precede camp assignments.");
        assert(getComputedStyle(notice).getPropertyValue("--ml-space-4").trim(), "Core styles must be loaded.");
        const detail = night.method === "nightDice" ? app.element.querySelector(`[data-night-encounter-id="${first.id}"]`) : notice;
        if (first.unwatched) assert(/unwatched.*no Perception check/i.test(detail.textContent), "Unwatched encounters must explain the absence of a roll request.");
        else assert(detail.querySelector(".ml-actor-identity"), "The watcher must use Core actor identity.");
      } finally {
        await app.close();
      }
    }
  }] });
}
