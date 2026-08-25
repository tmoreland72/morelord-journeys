export const DANGER_MODIFIERS = Object.freeze({ 0: -10, 1: 0, 2: 5, 3: 10, 4: 15, 5: 20 });

export function encounterOutcome(total, { night = false } = {}) {
  if (night) {
    if (total <= 30) return "peacefulRest";
    if (total <= 60) return "uneventful";
    if (total <= 85) return "minor";
    return "nightAttack";
  }
  if (total <= 40) return "none";
  if (total <= 60) return "signs";
  if (total <= 85) return "minor";
  return "major";
}

export function resolveEncounterRoll({ raw, danger = 0, modifiers = [], night = false }) {
  const dangerModifier = DANGER_MODIFIERS[Math.max(0, Math.min(5, Number(danger)))] ?? 0;
  const situational = modifiers.map(item => ({ ...item, value: Number(item.value ?? 0) }));
  const modified = Number(raw) + dangerModifier + situational.reduce((sum, item) => sum + item.value, 0);
  return { raw: Number(raw), danger: Number(danger), dangerModifier, modifiers: situational, modified, outcome: encounterOutcome(modified, { night }) };
}

export function automaticDayEncounterModifiers(journey) {
  const candidates = [];
  const weather = journey?.currentDay?.phases?.weather;
  const label = String(weather?.generated?.label ?? weather?.label ?? "").toLowerCase();
  if (weather?.extreme || /rain|snow|storm|wind|flood|fog|overcast/.test(label)) candidates.push({ id: "badWeather", label: "Bad weather / low visibility", value: 5 });
  else if (/fair|clear|comfortable/.test(label)) candidates.push({ id: "favorableWeather", label: "Favorable weather", value: -5 });
  if (journey?.currentDay?.pace === "slow") candidates.push({ id: "stealthy", label: "Slow, stealthy travel", value: -10 });
  if (journey?.routeSnapshot?.traffic === "high") candidates.push({ id: "road", label: "Road / high traffic", value: 5 });
  return candidates;
}
