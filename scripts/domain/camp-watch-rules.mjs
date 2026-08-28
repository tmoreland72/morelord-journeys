export const CAMP_WATCH_COUNT = 4;

export function assignedWatchIndexes(assignment) {
  if (assignment?.action !== "Take a Watch") return [];
  const source = Array.isArray(assignment.watchIndexes) ? assignment.watchIndexes : [assignment.watchIndex ?? assignment.index];
  return [...new Set(source.map(Number).filter(Number.isInteger))];
}

export function normalizeCampAssignments(travelers, saved = []) {
  const assigned = new Set(saved.flatMap(assignedWatchIndexes));
  return travelers.map((traveler, travelerIndex) => {
    const prior = saved.find(entry => entry.actorUuid === traveler.actorUuid) ?? {};
    const available = Array.from({ length: CAMP_WATCH_COUNT }, (_, index) => index).find(index => !assigned.has(index));
    const action = prior.action ?? (travelerIndex < CAMP_WATCH_COUNT ? "Take a Watch" : "Slumber");
    const legacyIndex = action === "Take a Watch" && Number.isInteger(Number(prior.index)) ? Number(prior.index) : null;
    const watchIndex = Number.isInteger(Number(prior.watchIndex)) ? Number(prior.watchIndex) : legacyIndex ?? available ?? null;
    const priorIndexes = assignedWatchIndexes(prior);
    const watchIndexes = action === "Take a Watch" ? (priorIndexes.length ? priorIndexes : [watchIndex]).filter(Number.isInteger) : [];
    const result = { ...prior, actorUuid: traveler.actorUuid, actorName: traveler.name, action, watchIndex: watchIndexes[0] ?? null, watchIndexes };
    for (const index of watchIndexes) assigned.add(index);
    return result;
  });
}

export function validateCampAssignments(assignments) {
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
    if (entry.action === "Slumber") return total;
    return total + (entry.action === "Take a Watch" ? Math.max(1, assignedWatchIndexes(entry).length) : 1);
  }, 0);
  return Math.max(0, Number(baseHours) - wakingPeriods * Number(hoursPerAssignment));
}
