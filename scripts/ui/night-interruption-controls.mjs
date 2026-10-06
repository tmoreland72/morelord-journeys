export function readNightInterruptions(root, journey) {
  return journey.currentDay.nightEncounterCheck.encounters.flatMap(encounter => {
    const row = root.querySelector(`[data-night-encounter-id="${encounter.id}"]`);
    const saved = journey.currentDay.sleepInterruptions?.find(entry => entry.encounterId === encounter.id);
    const hours = Math.max(1, Math.min(8, Math.ceil(Number(row?.querySelector("[data-night-hours]")?.value ?? saved?.hours ?? 1))));
    if (!Number.isFinite(hours)) throw new Error("Enter a valid encounter duration.");
    return journey.travelers.map(traveler => ({ actorUuid: traveler.actorUuid, actorName: traveler.name, encounterId: encounter.id,
      watchIndex: encounter.watchIndex, reason: "night encounter", count: 1, interruptsRest: true,
      startHour: encounter.startHour ?? encounter.watchIndex * 2, offsetHours: 0, hours, recordedAt: Date.now() }));
  });
}
