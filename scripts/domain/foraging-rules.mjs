export function foragingFoodFound({ succeeded, total = null, natural = null, automatic = false }) {
  if (!succeeded) return 0;
  if (!automatic && (natural === 20 || Number(total) >= 20)) return 2;
  return 1;
}

export function resolveForagingResults(travelers, results) {
  const byActor = new Map(results.map(result => [result.actorUuid, result]));
  const successful = travelers.filter(traveler => byActor.get(traveler.actorUuid)?.succeeded);
  const failed = travelers.filter(traveler => !byActor.get(traveler.actorUuid)?.succeeded);
  const bonusSources = successful.flatMap(traveler => {
    const result = byActor.get(traveler.actorUuid);
    return Array.from({ length: Math.max(0, Number(result.foodFound ?? 1) - 1) }, () => traveler.actorUuid);
  });
  const coveredFailedActorUuids = failed.slice(0, bonusSources.length).map(traveler => traveler.actorUuid);
  const foodActorUuids = failed.slice(coveredFailedActorUuids.length).map(traveler => traveler.actorUuid);
  const excessSources = bonusSources.slice(coveredFailedActorUuids.length);
  const excessFoodByActorUuid = Object.fromEntries([...new Set(excessSources)].map(actorUuid => [actorUuid, excessSources.filter(source => source === actorUuid).length]));
  return {
    successfulActorUuids: successful.map(traveler => traveler.actorUuid),
    failedActorUuids: failed.map(traveler => traveler.actorUuid),
    coveredFailedActorUuids,
    foodActorUuids,
    totalFoodFound: results.reduce((total, result) => total + Number(result.foodFound ?? 0), 0),
    excessFoodByActorUuid,
    foodRequired: foodActorUuids.length,
    waterRequired: successful.length ? 0 : travelers.length * 4,
    waterSourceFound: successful.length > 0
  };
}
