export function readNightInterruptions(root, journey) {
  return journey.currentDay.nightEncounterCheck.encounters.flatMap(encounter => {
    const row = root.querySelector(`[data-night-encounter-id="${encounter.id}"]`);
    if (!row) return (journey.currentDay.sleepInterruptions ?? []).filter(entry => entry.encounterId === encounter.id);
    const hours = Math.max(0, Math.min(8, Number(row.querySelector("[data-night-hours]")?.value ?? 0)));
    const count = Math.max(0, Math.floor(Number(row.querySelector("[data-night-count]")?.value ?? 0)));
    const offsetHours = Math.max(0, Math.min(journey.currentDay.nightEncounterCheck.intervalHours, Number(row.querySelector("[data-night-offset]")?.value ?? 0)));
    if (![hours, count, offsetHours].every(Number.isFinite)) throw new Error("Enter valid rest interruption values.");
    return journey.travelers.map(traveler => ({ actorUuid: traveler.actorUuid, actorName: traveler.name, encounterId: encounter.id,
      watchIndex: encounter.watchIndex, reason: "night encounter", count, interruptsRest: count > 0,
      startHour: encounter.startHour + offsetHours, offsetHours, hours, recordedAt: Date.now() }));
  });
}
