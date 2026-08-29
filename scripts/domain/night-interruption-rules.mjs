const INTERRUPTING_OUTCOMES = new Set(["minor", "nightAttack"]);

export function createNightEncounterInterruptions(travelers, { outcome, watchIndex = null, hours = 1, recordedAt = Date.now() } = {}) {
  if (!INTERRUPTING_OUTCOMES.has(outcome)) return [];
  const reason = outcome === "nightAttack" ? "night attack" : "night encounter";
  return (travelers ?? []).map(traveler => ({
    actorUuid: traveler.actorUuid,
    actorName: traveler.actorName,
    watchIndex,
    reason,
    suggestedHours: hours,
    hours,
    recordedAt
  }));
}
