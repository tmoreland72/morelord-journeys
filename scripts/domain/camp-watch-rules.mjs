export const CAMP_WATCH_COUNT = 4;

export function campWatchTiming(watchIndex) {
  return Number.isInteger(watchIndex) && watchIndex >= 0 && watchIndex < CAMP_WATCH_COUNT
    ? `Watch ${watchIndex + 1} (${watchIndex * 2}–${watchIndex * 2 + 2} hours after camp begins)`
    : "Watch timing not recorded";
}

export function assignedWatchIndexes(assignment) {
  if (!assignment) return [];
  if (Array.isArray(assignment.periods)) return assignment.periods.flatMap((period, index) => period.watch ? [index] : []);
  const source = Array.isArray(assignment.watchIndexes) ? assignment.watchIndexes
    : [assignment.watchIndex ?? (assignment.action === "Take a Watch" ? assignment.index : null)];
  return [...new Set(source.filter(value => value !== null && value !== undefined && value !== "").map(Number).filter(Number.isInteger))];
}

export function normalizeCampAssignments(travelers, saved = []) {
  const assigned = new Set(saved.flatMap(assignedWatchIndexes));
  return travelers.map((traveler, travelerIndex) => {
    const prior = saved.find(entry => entry.actorUuid === traveler.actorUuid) ?? {};
    const available = Array.from({ length: CAMP_WATCH_COUNT }, (_, index) => index).find(index => !assigned.has(index));
    const action = prior.action ?? (travelerIndex < CAMP_WATCH_COUNT ? "Take a Watch" : "Slumber");
    const priorIndexes = assignedWatchIndexes(prior);
    const watchIndexes = priorIndexes.length || Array.isArray(prior.watchIndexes) ? priorIndexes
      : action === "Take a Watch" && available !== undefined ? [available] : [];
    const result = { ...prior, actorUuid: traveler.actorUuid, actorName: traveler.name, action, watchIndex: watchIndexes[0] ?? null, watchIndexes };
    for (const index of watchIndexes) assigned.add(index);
    return result;
  });
}

export function validateCampAssignments(assignments) {
  for (const entry of assignments) {
    if (entry.periods && (entry.periods.length !== CAMP_WATCH_COUNT || entry.periods.some(period => !["Slumber", "Take a Watch", "Craft", "Cook", "Prepare", "Task"].includes(period.action) || period.watch && period.action === "Slumber"))) throw new Error("Each character needs four valid two-hour periods; watch duty must be awake.");
  }
  const indexes = assignments.flatMap(assignedWatchIndexes);
  if (indexes.length > CAMP_WATCH_COUNT) throw new Error(`Only ${CAMP_WATCH_COUNT} watch periods can be assigned.`);
  if (indexes.some(index => !Number.isInteger(index) || index < 0 || index >= CAMP_WATCH_COUNT)) throw new Error("Every watcher must have a valid watch period.");
  if (new Set(indexes).size !== indexes.length) throw new Error("Only one character can be assigned to each watch period.");
  return assignments;
}

export function watchCoverage(assignments) {
  return Array.from({ length: CAMP_WATCH_COUNT }, (_, watchIndex) => assignments.find(entry => assignedWatchIndexes(entry).includes(watchIndex)) ?? null);
}

export function availableCampSleepHours(assignments, actorUuid, { baseHours = 8, hoursPerAssignment = 2 } = {}) {
  const wakingPeriods = (assignments ?? []).filter(entry => entry.actorUuid === actorUuid).reduce((total, entry) => {
    if (Array.isArray(entry.periods)) return total + entry.periods.filter(period => period.watch || period.action !== "Slumber").length;
    const watches = assignedWatchIndexes(entry).length;
    const periods = Math.max(watches, entry.action === "Slumber" ? 0 : 1);
    return total + periods + (entry.action === "Take a Watch" && entry.additionalAction && entry.additionalAction !== "Slumber" ? 1 : 0);
  }, 0);
  return Math.max(0, Number(baseHours) - wakingPeriods * Number(hoursPerAssignment));
}

export function campPeriods(assignment) {
  if (Array.isArray(assignment?.periods)) return assignment.periods.map(period => ({ ...period }));
  const watches = assignedWatchIndexes(assignment);
  const periods = Array.from({ length: CAMP_WATCH_COUNT }, (_, index) => ({ watch: watches.includes(index), action: watches.includes(index) ? (assignment.action === "Slumber" ? "Take a Watch" : assignment.action) : "Slumber" }));
  const extra = watches.length ? assignment.additionalAction : assignment?.action;
  if (extra && !["Slumber", "Take a Watch"].includes(extra)) {
    const free = periods.find(period => !period.watch);
    if (free) free.action = extra;
  }
  return periods;
}

export function campWatchAction(assignment, index) {
  return assignment?.periods?.[index]?.action ?? assignment?.action;
}
