export function normalizeActivityHours(value, fallback = 2) {
  const hours = Number(value);
  return Number.isFinite(hours) ? Math.max(0, Math.min(24, hours)) : fallback;
}

export function normalizeTemporaryCapabilities(values = []) {
  const validTiers = new Set(["common", "uncommon", "rare", "veryRare", "legendary"]);
  return values
    .filter(value => value?.type)
    .map(value => {
      const tier = String(value.tier ?? "common").trim();
      if (!validTiers.has(tier)) throw new Error(`Unknown temporary capability tier: ${tier}.`);
      return {
      type: String(value.type).trim(),
      tier,
      specialty: value.specialty ? String(value.specialty).trim() : null,
      source: value.source ? String(value.source).trim() : "journey"
    }; });
}

export function parseTemporaryCapabilities(value = "") {
  return normalizeTemporaryCapabilities(String(value)
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const [type, tier = "common", specialty = null] = entry.split(":").map(part => part.trim());
      return { type, tier, specialty: specialty || null, source: "journey" };
    }));
}

export function updateJourneyTravelContext(source, { locationId = null, activityHours = 2, temporaryCapabilities = [] } = {}) {
  const journey = structuredClone(source);
  journey.currentLocationId = locationId ? String(locationId) : null;
  journey.activityHoursPerDay = normalizeActivityHours(activityHours, 2);
  journey.temporaryCapabilities = normalizeTemporaryCapabilities(temporaryCapabilities);
  if (journey.currentDay) {
    journey.currentDay.locationId = journey.currentLocationId;
    journey.currentDay.activityHours = journey.activityHoursPerDay;
    journey.currentDay.temporaryCapabilities = structuredClone(journey.temporaryCapabilities);
  }
  return journey;
}

export function getJourneyTravelContext(journey, { locationResolver = () => null } = {}) {
  const day = journey?.currentDay;
  const locationId = day?.locationId ?? journey?.currentLocationId ?? null;
  const location = locationId ? locationResolver(locationId) : null;
  return {
    locationId,
    location: location ?? {
      id: "road",
      name: "On the Road",
      settlementType: "road",
      sceneIds: [],
      capabilities: [],
      notes: "",
      metadata: { virtual: true }
    },
    activityHours: normalizeActivityHours(day?.activityHours ?? journey?.activityHoursPerDay, 2),
    temporaryCapabilities: normalizeTemporaryCapabilities(
      day?.temporaryCapabilities ?? journey?.temporaryCapabilities ?? []
    )
  };
}

export function createDayCompletionPayload(journey, completedDay, options = {}) {
  const snapshot = { ...journey, currentDay: completedDay };
  const context = getJourneyTravelContext(snapshot, options);
  return {
    journeyId: journey.id,
    day: completedDay.number,
    idempotencyKey: `journey:${journey.id}:day:${completedDay.number}`,
    locationId: context.locationId,
    location: context.location,
    downtimeHours: context.activityHours,
    temporaryCapabilities: context.temporaryCapabilities,
    metadata: {
      pace: completedDay.pace ?? null,
      appliedProgressSteps: completedDay.appliedProgressSteps ?? 0,
      arrived: journey.status === "arrived"
    }
  };
}
