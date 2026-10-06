import test from "node:test";
import assert from "node:assert/strict";
import { TRAVEL_PHASES, MODULE_ID } from "../../scripts/domain/constants.mjs";
import { includedJourneyPhases } from "../../scripts/core/journey-step-policy.mjs";
import { publishJourneyProgress } from "../../scripts/services/progress-chat-service.mjs";

test("all disabled/skipped phases are excluded from completion posting and sequence", async () => {
  globalThis.foundry = { utils: { escapeHTML: String } };
  const messages = [];
  globalThis.game = { user: { isGM: true }, settings: { get: () => true }, i18n: { localize: key => key.split('.').at(-1) }, messages: { contents: messages } };
  globalThis.ChatMessage = { create: async data => {
    const message = { ...data, delete: async () => messages.splice(messages.indexOf(message), 1), update: async changes => Object.assign(message, changes) };
    messages.push(message);
  } };
  const phases = TRAVEL_PHASES.slice(0, -1);
  const make = disabled => ({ id: "fixture", dayNumber: 1, steps: Object.fromEntries(phases.map(phase => [phase, !disabled.includes(phase)])), currentDay: { pace: "normal", phases: {} }, log: phases.map(phase => ({ id: phase, type: "phaseRecorded", dayNumber: 1, data: { phase, result: disabled.includes(phase) ? { skipped: true } : {} } })) });
  for (const disabled of [phases.slice(0, 7), ...phases.map(phase => [phase]), phases]) {
    messages.length = 0;
    const journey = make(disabled);
    await publishJourneyProgress(null, journey);
    const included = includedJourneyPhases(journey);
    assert.equal(messages.length, included.length);
    assert.deepEqual(messages.map(message => message.flags[MODULE_ID].journeyProgress.phase), included);
    messages.forEach((message, index) => assert.ok(message.content.includes(`step ${index + 1} of ${included.length}`)));
  }
  messages.length = 0;
  const prior = make([]);
  await publishJourneyProgress(null, prior);
  const other = { ...messages[0], flags: { [MODULE_ID]: { journeyProgress: { journeyId: "other", phase: "weather" } } }, delete: async () => assert.fail("Other journeys must be retained") };
  messages.push(other);
  const next = make(phases.slice(0, 7));
  await publishJourneyProgress(prior, next);
  assert.deepEqual(messages.filter(message => message !== other).map(message => message.flags[MODULE_ID].journeyProgress.phase), ["camp", "sleep"]);
  assert.ok(messages[0].content.includes("step 1 of 2"));
  messages.length = 0;
  const stopped = make([]);
  stopped.currentDay.pace = "stopped";
  await publishJourneyProgress(null, stopped);
  assert.equal(messages.length, 5);
  assert.ok(!messages.some(message => ["encounters", "discovery", "navigation", "pressOn"].includes(message.flags[MODULE_ID].journeyProgress.phase)));
  const skipped = make([]);
  skipped.log[0].data.result.skipped = true;
  assert.ok(!includedJourneyPhases(skipped).includes("weather"));
});
