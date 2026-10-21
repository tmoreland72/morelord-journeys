/** Whole hours from 0 through 8. A missing value uses the fallback; 0 is kept. */
export function clampEncounterDuration(value, fallback = 1) {
  const missing = value == null || value === "";
  const parsed = Number(missing ? fallback : value);
  if (!Number.isFinite(parsed)) throw new Error("Enter a valid encounter duration.");
  return Math.max(0, Math.min(8, Math.ceil(parsed)));
}

export function readNightInterruptions(root, journey) {
  return journey.currentDay.nightEncounterCheck.encounters.flatMap(encounter => {
    const row = root.querySelector(`[data-night-encounter-id="${encounter.id}"]`);
    const saved = journey.currentDay.sleepInterruptions?.find(entry => entry.encounterId === encounter.id);
    const hours = clampEncounterDuration(row?.querySelector("[data-night-hours]")?.value ?? saved?.hours, 1);
    const interruptsRest = hours > 0;
    return journey.travelers.map(traveler => ({ actorUuid: traveler.actorUuid, actorName: traveler.name, encounterId: encounter.id,
      watchIndex: encounter.watchIndex, reason: "night encounter", count: interruptsRest ? 1 : 0, interruptsRest,
      startHour: encounter.startHour ?? encounter.watchIndex * 2, offsetHours: 0, hours, recordedAt: Date.now() }));
  });
}
