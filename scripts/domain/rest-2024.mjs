import { campPeriods } from "./camp-watch-rules.mjs";

const hours = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);

/** A watch is two hours. Events use hours from camp start, not wall-clock time. */
export function evaluateRest2024({ assignment, requiredSleepHours = 6, sleepHours = 8,
  extraRestHours = 0, interruptionSources = [], eligibleToStart = true } = {}) {
  const required = Math.max(1, hours(requiredSleepHours));
  const shortened = required < 6;
  const duration = shortened ? required : Math.max(8, required);
  const extra = hours(extraRestHours);
  const end = 8 + extra;
  const periods = campPeriods(assignment ?? { action: "Slumber" });
  const slots = periods.map((period, index) => ({ start: index * 2, end: index * 2 + 2,
    kind: !period.watch && period.action === "Slumber" ? "sleep"
      : period.action === "Take a Watch" ? "light" : "work" }));
  if (extra) slots.push({ start: 8, end, kind: "sleep" });
  const plannedSleepHours = Math.min(hours(sleepHours), slots.filter(s => s.kind === "sleep" && s.start < 8).length * 2) + extra;
  const start = slots.find(slot => shortened ? slot.kind === "sleep" : slot.kind !== "work")?.start ?? end;
  const events = interruptionSources.map(source => {
    const validWatch = source.watchIndex !== null && source.watchIndex !== undefined && source.watchIndex !== ""
      && Number.isInteger(Number(source.watchIndex)) && Number(source.watchIndex) >= 0 && Number(source.watchIndex) < 4;
    const eventStart = source.startHour != null ? hours(source.startHour) : validWatch ? Number(source.watchIndex) * 2 : start;
    return { ...source, start: eventStart, end: eventStart + hours(source.hours ?? Number(source.minutes ?? 0) / 60),
      interruptsRest: source.interruptsRest !== false, timingEstimated: source.startHour == null };
  });
  // A full two-hour work period is physical exertion, not light activity.
  for (const slot of slots.filter(slot => slot.kind === "work" && slot.start > start)) {
    events.push({ start: slot.start, end: slot.end, interruptsRest: true, reason: "scheduled camp work", watchIndex: slot.start / 2 });
  }
  const boundaries = [...new Set([start, end, ...slots.flatMap(s => [s.start, s.end]), ...events.flatMap(e => [e.start, e.end])])]
    .filter(t => t >= start && t <= end).sort((a, b) => a - b);
  let slept = 0, rested = 0, light = 0, lostSleep = 0, count = 0, completedAt = null;
  const relevant = [], ignored = [];
  for (let i = 0; i < boundaries.length; i++) {
    const time = boundaries[i];
    if (completedAt === null && slept >= required && rested >= duration + count && eligibleToStart) completedAt = time;
    for (const event of events.filter(e => e.start === time)) {
      if (completedAt !== null) ignored.push(event);
      else { relevant.push(event); if (event.interruptsRest) count += Math.max(1, Math.floor(hours(event.count ?? 1))); }
    }
    if (completedAt !== null || i === boundaries.length - 1) continue;
    const next = boundaries[i + 1];
    const span = next - time;
    const slot = slots.find(s => s.start <= time && s.end > time);
    const interrupted = events.some(e => e.start < next && e.end > time);
    if (slot?.kind === "sleep" && interrupted) lostSleep += span;
    if (interrupted) continue;
    let sleepCredit = slot?.kind === "sleep" ? Math.min(span, Math.max(0, plannedSleepHours - slept - lostSleep)) : 0;
    let lightCredit = !shortened && slot?.kind === "light" ? Math.min(span, Math.max(0, 2 - light)) : 0;
    const restCredit = sleepCredit + lightCredit;
    if (slept + sleepCredit >= required && rested + restCredit >= duration + count && eligibleToStart) {
      const needed = Math.max(Math.max(0, required - slept), Math.max(0, duration + count - rested));
      completedAt = time + needed;
      sleepCredit = Math.min(sleepCredit, needed);
      lightCredit = Math.min(lightCredit, needed);
    }
    slept += sleepCredit; light += lightCredit; rested += sleepCredit + lightCredit;
  }
  return { rules: "2024", scheduledSleepHours: plannedSleepHours, sleepHours: slept,
    awakeActivities: slots.filter(slot => slot.start < 8 && slot.kind !== "sleep").map(slot => `Watch ${slot.start / 2 + 1}: ${slot.kind === "light" ? "standing watch" : "camp work"}`),
    requiredSleepHours: required, requiredRestHours: duration, restHours: rested,
    extraRestHours: extra, lostSleepHours: lostSleep, interruptionCount: count,
    interruptionHours: relevant.reduce((sum, e) => sum + e.end - e.start, 0),
    interruptionSources: relevant, ignoredInterruptions: ignored,
    completedAt, eligibleToStart: Boolean(eligibleToStart), longRestCompleted: completedAt !== null,
    missingSleepHours: Math.max(0, required - slept), missingRestHours: Math.max(0, duration + count - rested) };
}

export function restResultBullets(result) {
  const timing = result.restAssessment;
  const needed = result.requiredSleepHours ?? 6;
  const enough = Number(result.sleepHours ?? 0) >= needed;
  const bullets = [enough
    ? `You got enough sleep or meditation: ${result.sleepHours} hours; ${needed} required.`
    : `You did not get enough sleep or meditation: ${result.sleepHours ?? 0} hours; ${needed} required.`];
  if (timing) {
    if (timing.awakeActivities?.length) bullets.push(`Time awake: ${timing.awakeActivities.join("; ")}.`);
    if (timing.lostSleepHours) bullets.push(`Interruptions took away ${timing.lostSleepHours} hours of scheduled sleep.`);
    if (timing.interruptionCount) bullets.push(`${timing.interruptionCount} interruption(s) before completion added ${timing.interruptionCount} hours to the required rest, in addition to time spent interrupted.`);
    if (timing.ignoredInterruptions.length) bullets.push("The later encounter happened after your rest was complete and did not cancel it.");
    if (timing.missingRestHours) bullets.push(`You still needed ${timing.missingRestHours} more hours of rest${timing.missingSleepHours ? `, including ${timing.missingSleepHours} hours of sleep or meditation` : ""}.`);
    if (!timing.eligibleToStart) bullets.push("You were not eligible to start: you need at least 1 HP and 16 hours since finishing your previous Long Rest.");
    bullets.push("No sleep check is required under the 2024 rest rules.");
  } else {
    bullets.push(result.succeeded ? "You passed the sleep check." : "You failed the sleep check, so the earlier Journeys rules denied the Long Rest.");
    if (Number(result.interruptionHours ?? 0) >= 1) bullets.push(`The earlier Journeys rules denied the rest because ${result.interruptionHours} interrupted hours were recorded, regardless of when they occurred.`);
    bullets.push("This is a saved result from the earlier rules; it has not been recalculated.");
  }
  bullets.push(result.longRestCompleted ? "Long Rest completed." : "Long Rest not completed.");
  if (result.longRestCompleted && (result.fed === false || result.watered === false)) bullets.push("Food or water is still missing; the existing supply rules prevent Exhaustion recovery.");
  if (result.deprivation && !result.deprivation.suppressed) bullets.push(`You ${result.deprivation.succeeded ? "passed" : "failed"} the optional sleep-deprivation save${result.deprivation.total != null ? ` (${result.deprivation.total} against DC ${result.deprivation.dc})` : " (GM result)"}.`);
  const change = Number(result.exhaustionChange ?? 0);
  bullets.push(change > 0 ? `You gained ${change} Exhaustion level(s).` : change < 0 ? `You recovered ${-change} Exhaustion level(s).` : "Your Exhaustion did not change.");
  return bullets;
}
