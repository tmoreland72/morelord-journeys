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

// Found food splits into today's expedition supply and surplus stored on foragers.
// Extra rations cover failed travelers first. The surplus is excessFoodByActorUuid,
// not the inventory receipt in excessRationsAdded.
export function foragingFoodSplit(resolution = {}) {
  const found = Math.max(0, Number(resolution?.totalFoodFound ?? resolution?.successfulActorUuids?.length ?? 0) || 0);
  const excess = Math.max(0, resolution?.excessFoodByActorUuid
    ? Object.values(resolution.excessFoodByActorUuid).reduce((total, amount) => total + (Number(amount) || 0), 0)
    : (resolution?.excessRationsAdded ?? []).reduce((total, entry) => total + (Number(entry?.quantity) || 0), 0));
  return { found, toPool: Math.max(0, found - excess), excess };
}

export function formatForagingFoodSplit(resolution) {
  const { found, toPool, excess } = foragingFoodSplit(resolution);
  const parts = [];
  if (toPool > 0) parts.push(`${toPool} to pool`);
  if (excess > 0) parts.push(`${excess} excess to foragers`);
  return parts.length ? `Found ${found} food: ${parts.join(", ")}` : `Found ${found} food`;
}

export function formatForagingLogResult(resolution) {
  if (!resolution) return "Resolved";
  return `${formatForagingFoodSplit(resolution)}; ${resolution.foodRequired ?? 0} ration(s) and ${resolution.waterRequired ?? 0} water pint(s) still required`;
}

export function formatForagingOutcomeText(resolution = {}) {
  const water = resolution?.waterSourceFound
    ? " A forager found water for everyone; carried water is not consumed and containers may be refilled."
    : "";
  return `${formatForagingFoodSplit(resolution)}; ${resolution?.foodRequired ?? 0} ration(s) still required; ${resolution?.waterRequired ?? 0} pint(s) of water required.${water}`;
}
