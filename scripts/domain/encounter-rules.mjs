export const DANGER_MODIFIERS = Object.freeze({ 0: -10, 1: 0, 2: 5, 3: 10, 4: 15, 5: 20 });

export const DAY_ENCOUNTER_DICE = Object.freeze([4, 6, 8, 10, 12, 20, 100]);

export function resolveDayEncounterChecks({ danger, dieFaces, travelerRolls }) {
  if (!Number.isInteger(danger) || danger < 0 || danger > 5) throw new Error("Danger must be between 0 and 5.");
  if (!DAY_ENCOUNTER_DICE.includes(dieFaces)) throw new Error("Choose a supported daytime encounter die.");
  const results = travelerRolls.flatMap(traveler => {
    if (traveler.results.length !== danger || traveler.results.some(value => !Number.isInteger(value) || value < 1 || value > dieFaces)) {
      throw new Error("Each traveler must roll once per Danger level.");
    }
    return traveler.results;
  });
  const ones = results.filter(value => value === 1).length;
  const maximums = results.filter(value => value === dieFaces).length;
  const encounterCount = Math.max(0, ones - maximums);
  return { method: "partyDice", danger, dieFaces, travelerRolls, totalRolls: results.length, ones, maximums, encounterCount, outcome: encounterCount ? "encounter" : "none" };
}

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
