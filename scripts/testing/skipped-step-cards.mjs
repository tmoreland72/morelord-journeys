import { runInGameTests, assert } from "../../../morelord-core/scripts/testing/in-game.js";
import { MODULE_ID, TRAVEL_PHASES } from "../domain/constants.mjs";
import { publishJourneyProgress } from "../services/progress-chat-service.mjs";

export async function runSkippedStepCardTests() {
  return runInGameTests({ checks: [{ id: "journeys.skipped-step-completion-cards", async run() {
    assert(game.user.isGM, "Run as GM in Dev1.");
    const id = foundry.utils.randomID();
    const phases = TRAVEL_PHASES.slice(0, -1);
    const journey = { id, dayNumber: 1, steps: Object.fromEntries(phases.map(phase => [phase, ["camp", "sleep"].includes(phase)])), currentDay: { pace: "normal", phases: {} }, log: phases.map(phase => ({ id: foundry.utils.randomID(), type: "phaseRecorded", dayNumber: 1, data: { phase, result: { skipped: !["camp", "sleep"].includes(phase) } } })) };
    const cards = () => game.messages.contents.filter(message => message.flags?.[MODULE_ID]?.journeyProgress?.journeyId === id);
    try {
      await publishJourneyProgress(null, journey);
      assert(cards().length === 2, "Seven disabled steps must create no cards.");
      assert(cards().every(message => ["camp", "sleep"].includes(message.flags[MODULE_ID].journeyProgress.phase)), "Only enabled phases may post.");
      assert(cards()[0].content.includes("step 1 of 2") && cards()[1].content.includes("step 2 of 2"), "Sequence must use included steps only.");
      journey.steps.camp = false;
      await publishJourneyProgress(journey, journey);
      assert(cards().length === 1 && cards()[0].content.includes("step 1 of 1"), "Disabling a completed step removes its stale card and renumbers the remaining card.");
    } finally { for (const message of cards()) await message.delete(); }
  } }] });
}
