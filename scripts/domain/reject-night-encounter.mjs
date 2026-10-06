export function rejectNightEncounter(journey, encounterId) {
  const day = journey.currentDay;
  const night = day?.nightEncounterCheck;
  const encounter = night?.encounters?.find(entry => entry.id === encounterId);
  if (!encounter || journey.phase !== "camp") return [];
  night.rejectedEncounters ??= [];
  night.rejectedEncounters.push({ ...encounter, rejectedAt: Date.now() });
  night.encounters = night.encounters.filter(entry => entry.id !== encounterId);
  night.encounterCount = night.encounters.length;
  day.sleepInterruptions = (day.sleepInterruptions ?? []).filter(entry => entry.encounterId !== encounterId);
  const stillNeeded = night.encounters.some(entry => entry.watchIndex === encounter.watchIndex && !entry.unwatched);
  const removed = stillNeeded ? [] : (day.pendingCampPerceptionRolls ?? []).filter(entry => entry.watchIndex === encounter.watchIndex);
  day.pendingCampPerceptionRolls = (day.pendingCampPerceptionRolls ?? []).filter(entry => !removed.includes(entry));
  return removed;
}
