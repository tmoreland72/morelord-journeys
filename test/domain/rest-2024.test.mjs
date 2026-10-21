import test from "node:test";
import assert from "node:assert/strict";
import { describeInterruptedHours, evaluateRest2024, interruptionSourceSummary, restResultBullets } from "../../scripts/domain/rest-2024.mjs";

const assignment = (...actions) => ({ periods: actions.map(action => ({ action, watch: action === "Take a Watch" })) });
const bufoma = assignment("Take a Watch", "Slumber", "Slumber", "Task");
const normal = assignment("Take a Watch", "Slumber", "Slumber", "Slumber");
const attack = (watchIndex, hours = 1) => ({ watchIndex, hours, reason: "night attack" });

test("Bufoma finishes four-hour Trance before a watch-four encounter", () => {
  const result = evaluateRest2024({ assignment: bufoma, requiredSleepHours: 4, interruptionSources: [attack(3)] });
  assert.equal(result.longRestCompleted, true);
  assert.equal(result.completedAt, 6);
  assert.equal(result.sleepHours, 4);
  assert.equal(result.interruptionCount, 0);
  assert.ok(result.ignoredInterruptions.some(e => e.reason === "night attack"));
});
test("six hours of sleep does not finish a standard rest before hour eight", () => {
  const result = evaluateRest2024({ assignment: assignment("Slumber", "Slumber", "Slumber", "Take a Watch"), interruptionSources: [attack(3, .25)] });
  assert.equal(result.longRestCompleted, false);
  assert.equal(result.sleepHours, 6);
  assert.equal(result.interruptionCount, 1);
  assert.equal(result.missingRestHours, 1.25);
});
test("interruption subtracts sleep; extra rest can cover lost time and the recovery hour", () => {
  const options = { assignment: normal, interruptionSources: [attack(2)] };
  const failed = evaluateRest2024(options);
  assert.equal(failed.sleepHours, 5);
  assert.equal(failed.lostSleepHours, 1);
  assert.equal(failed.longRestCompleted, false);
  const resumed = evaluateRest2024({ ...options, extraRestHours: 2 });
  assert.equal(resumed.longRestCompleted, true);
  assert.equal(resumed.completedAt, 10);
});
test("zero hours does not interrupt, and one hour still does", () => {
  const quiet = evaluateRest2024({ assignment: normal, interruptionSources: [attack(2, 0)] });
  assert.equal(quiet.longRestCompleted, true);
  assert.equal(quiet.interruptionCount, 0);
  assert.equal(quiet.interruptionHours, 0);
  assert.equal(quiet.lostSleepHours, 0);
  assert.equal(quiet.sleepHours, 6);
  assert.equal(quiet.missingRestHours, 0);
  const quietBullets = restResultBullets({ ...quiet, restAssessment: quiet, exhaustionChange: 0 });
  assert.ok(quietBullets.some(text => text.includes("not interrupted")));
  assert.equal(quietBullets.some(text => text.includes("added")), false);
  const counted = evaluateRest2024({ assignment: normal, interruptionSources: [{ ...attack(2, 0), interruptsRest: true, count: 3 }] });
  assert.equal(counted.longRestCompleted, true);
  assert.equal(counted.interruptionCount, 0);
  assert.equal(counted.interruptionHours, 0);
  const midpoint = evaluateRest2024({ assignment: normal, interruptionSources: [{ startHour: 4.5, hours: 0, interruptsRest: true, count: 1 }] });
  assert.equal(midpoint.longRestCompleted, true);
  assert.equal(midpoint.lostSleepHours, 0);
  assert.equal(midpoint.sleepHours, 6);
  const hour = evaluateRest2024({ assignment: normal, interruptionSources: [attack(2, 1)] });
  assert.equal(hour.longRestCompleted, false);
  assert.equal(hour.interruptionCount, 1);
  assert.equal(hour.interruptionHours, 1);
  assert.equal(hour.lostSleepHours, 1);
  assert.equal(hour.sleepHours, 5);
  const hourBullets = restResultBullets({ ...hour, restAssessment: hour, exhaustionChange: 1 });
  assert.ok(hourBullets.some(text => text.includes("added 1 hour")));
  assert.equal(hourBullets.some(text => text.includes("not interrupted")), false);
  const beside = evaluateRest2024({ assignment: normal, interruptionSources: [attack(1, 0), attack(2, 1)] });
  assert.equal(beside.interruptionCount, hour.interruptionCount);
  assert.equal(beside.lostSleepHours, hour.lostSleepHours);
  assert.equal(beside.interruptionHours, hour.interruptionHours);
  assert.equal(beside.sleepHours, hour.sleepHours);
  assert.equal(beside.longRestCompleted, hour.longRestCompleted);
  assert.equal(describeInterruptedHours(0), "not interrupted");
  assert.equal(describeInterruptedHours(1), "1 hours");
  assert.equal(describeInterruptedHours(2), "2 hours");
  assert.equal(interruptionSourceSummary([{ reason: "night encounter", hours: 0, watchIndex: 1 }], 0), "not interrupted");
  assert.equal(interruptionSourceSummary([{ reason: "night encounter", hours: 1, watchIndex: 2 }, { reason: "night encounter", hours: 0, watchIndex: 0 }], 1), "night encounter during Watch 3: 1 hour(s)");
  const legacyQuiet = restResultBullets({ sleepHours: 8, requiredSleepHours: 6, succeeded: true, longRestCompleted: true, interruptionHours: 0, exhaustionChange: 0 });
  assert.ok(legacyQuiet.some(text => text.includes("not interrupted")));
  const legacyHour = restResultBullets({ sleepHours: 8, requiredSleepHours: 6, succeeded: true, longRestCompleted: false, interruptionHours: 1, exhaustionChange: 0 });
  assert.ok(legacyHour.some(text => text.includes("1 interrupted")));
  assert.equal(legacyHour.some(text => text.includes("not interrupted")), false);
});
test("Trance interrupted before completion requires extra recovery time", () => {
  const result = evaluateRest2024({ assignment: bufoma, requiredSleepHours: 4, interruptionSources: [attack(2)] });
  assert.equal(result.longRestCompleted, false);
  assert.equal(result.sleepHours, 3);
});
test("each interruption counts once and overlapping time is not subtracted twice", () => {
  const result = evaluateRest2024({ assignment: normal, interruptionSources: [attack(2), { startHour: 4.5, hours: 1 }] });
  assert.equal(result.interruptionCount, 2);
  assert.equal(result.lostSleepHours, 1.5);
});
test("work before Trance does not count as an interruption of a rest not yet started", () => {
  const result = evaluateRest2024({ assignment: assignment("Craft", "Slumber", "Slumber", "Task"), requiredSleepHours: 4 });
  assert.equal(result.longRestCompleted, true);
  assert.equal(result.completedAt, 6);
});
test("starting eligibility, insufficient scheduled sleep and GM caps are respected", () => {
  assert.equal(evaluateRest2024({ assignment: normal, eligibleToStart: false }).longRestCompleted, false);
  assert.equal(evaluateRest2024({ assignment: normal, sleepHours: 4 }).longRestCompleted, false);
  assert.equal(evaluateRest2024({ assignment: assignment("Take a Watch", "Take a Watch", "Slumber", "Slumber") }).longRestCompleted, false);
});
test("clear bullets distinguish sleep lost, recovery time, legacy checks and actual Exhaustion", () => {
  const restAssessment = evaluateRest2024({ assignment: normal, interruptionSources: [attack(2)] });
  const bullets = restResultBullets({ ...restAssessment, restAssessment, exhaustionChange: 1, deprivation: { dc: 10, total: 5, succeeded: false } });
  assert.ok(bullets.some(text => text.includes("did not get enough")));
  assert.ok(bullets.some(text => text.includes("took away 1")));
  assert.ok(bullets.some(text => text.includes("No sleep check")));
  assert.ok(bullets.some(text => text.includes("gained 1")));
  const legacy = restResultBullets({ sleepHours: 6, requiredSleepHours: 6, succeeded: false, longRestCompleted: false });
  assert.ok(legacy.some(text => text.includes("got enough sleep")));
  assert.ok(legacy.some(text => text.includes("failed the sleep check")));
});
