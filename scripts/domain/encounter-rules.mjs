export const DANGER_MODIFIERS = Object.freeze({ 0: -10, 1: 0, 2: 5, 3: 10, 4: 15, 5: 20 });

export const DANGER_DICE = Object.freeze([20, 12, 10, 8, 6, 4]);
export function dangerDie(danger) {
  if (!Number.isInteger(danger) || danger < 0 || danger > 5) throw new Error("Danger must be between 0 and 5.");
  return DANGER_DICE[danger];
}

// Pool before play: maximums cancel the latest triggered slots first.
export function resolveDangerDice({ danger, results, campfire = false }) {
  const dieFaces = dangerDie(danger);
  if (results.some(value => !Number.isInteger(value) || value < 1 || value > dieFaces)) throw new Error("Encounter dice must match the Danger die.");
  const triggers = results.flatMap((value, index) => value <= (campfire ? 2 : 1) ? [index] : []);
  const maximums = results.filter(value => value === dieFaces).length;
  const cancellations = dieFaces > 6 ? Math.min(triggers.length, maximums) : 0;
  const encounterIndexes = triggers.slice(0, triggers.length - cancellations);
  return { rulesVersion: 2, danger, dieFaces, results, totalRolls: results.length, ones: results.filter(value => value === 1).length,
    triggers: triggers.length, maximums, cancellations, campfire, encounterIndexes, encounterCount: encounterIndexes.length,
    outcome: encounterIndexes.length ? "encounter" : "none" };
}

export function resolveNightDice({ danger, results, campfire = false, intervalHours = 2 }) {
  if (![1, 2].includes(intervalHours) || results.length !== 8 / intervalHours) throw new Error("Roll once per hour or two-hour watch for the eight-hour night.");
  const resolved = resolveDangerDice({ danger, results, campfire });
  return { ...resolved, method: "nightDice", intervalHours, outcome: resolved.encounterCount ? "encounter" : "uneventful",
    encounters: resolved.encounterIndexes.map(index => ({ id: "night-" + index, slotIndex: index, startHour: index * intervalHours, endHour: (index + 1) * intervalHours, watchIndex: Math.floor(index * intervalHours / 2) })) };
}

export function nightEncounterTiming(encounter) {
  return `Watch ${encounter.watchIndex + 1} (${encounter.startHour}–${encounter.endHour} hours after camp begins)`;
}

export const DEFAULT_NIGHT_ENCOUNTER_CONFIGURATION = Object.freeze({
  peacefulMax: 30, uneventfulMax: 60, minorMax: 85,
  dangerModifiers: Object.freeze([-10, 0, 5, 10, 15, 20]),
  favorableWeather: -5, badWeather: 5,
  poorCamp: 10, ordinaryCamp: 0, campfireCamp: -5,
  stoppedDangerReduction: 1
});

export function nightEncounterConfiguration(saved = {}) {
  return { ...DEFAULT_NIGHT_ENCOUNTER_CONFIGURATION, ...saved,
    dangerModifiers: DEFAULT_NIGHT_ENCOUNTER_CONFIGURATION.dangerModifiers.map((value, index) => saved.dangerModifiers?.[index] ?? value) };
}

export function validateNightEncounterConfiguration(config) {
  const cutoffs = [config.peacefulMax, config.uneventfulMax, config.minorMax];
  if (cutoffs.some(value => !Number.isInteger(value) || value < 0 || value > 100)
      || !(cutoffs[0] < cutoffs[1] && cutoffs[1] < cutoffs[2])) {
    throw new Error("Night encounter cutoffs must be whole numbers from 0 to 100 in increasing order.");
  }
  const modifiers = [...config.dangerModifiers, config.favorableWeather, config.badWeather, config.poorCamp, config.ordinaryCamp, config.campfireCamp];
  if (config.dangerModifiers.length !== 6 || modifiers.some(value => !Number.isInteger(value) || value < -100 || value > 100)) throw new Error("Night encounter modifiers must be whole numbers from -100 to 100.");
  if (!Number.isInteger(config.stoppedDangerReduction) || config.stoppedDangerReduction < 0 || config.stoppedDangerReduction > 5) throw new Error("Stopped Danger reduction must be a whole number from 0 to 5.");
  return config;
}

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

export function encounterOutcome(total, { night = false, configuration = DEFAULT_NIGHT_ENCOUNTER_CONFIGURATION } = {}) {
  if (night) {
    if (total <= configuration.peacefulMax) return "peacefulRest";
    if (total <= configuration.uneventfulMax) return "uneventful";
    if (total <= configuration.minorMax) return "minor";
    return "nightAttack";
  }
  if (total <= 40) return "none";
  if (total <= 60) return "signs";
  if (total <= 85) return "minor";
  return "major";
}

export function resolveEncounterRoll({ raw, danger = 0, modifiers = [], night = false, configuration = DEFAULT_NIGHT_ENCOUNTER_CONFIGURATION }) {
  const dangerModifier = (night ? configuration.dangerModifiers : DANGER_MODIFIERS)[Math.max(0, Math.min(5, Number(danger)))] ?? 0;
  const situational = modifiers.map(item => ({ ...item, value: Number(item.value ?? 0) }));
  const modified = Number(raw) + dangerModifier + situational.reduce((sum, item) => sum + item.value, 0);
  return { raw: Number(raw), danger: Number(danger), dangerModifier, modifiers: situational, modified, outcome: encounterOutcome(modified, { night, configuration }) };
}
