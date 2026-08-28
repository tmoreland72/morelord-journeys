export function qualifiesForLongRest({ sleepCheckSucceeded, sleepHours, requiredSleepHours = 6, interruptionHours, interruptionMinutes }) {
  const interrupted = interruptionHours == null ? Number(interruptionMinutes ?? 0) / 60 : Number(interruptionHours);
  return Boolean(sleepCheckSucceeded) && Number(sleepHours) >= Number(requiredSleepHours) && interrupted < 1;
}

export function longRestFailureReasons({ sleepCheckSucceeded, sleepHours, requiredSleepHours = 6, interruptionHours, interruptionMinutes }) {
  const interrupted = interruptionHours == null ? Number(interruptionMinutes ?? 0) / 60 : Number(interruptionHours);
  const reasons = [];
  if (!sleepCheckSucceeded) reasons.push("the sleep check failed");
  if (Number(sleepHours) < Number(requiredSleepHours)) reasons.push(`only ${Number(sleepHours)} sleep hours were completed; at least ${Number(requiredSleepHours)} are required`);
  if (interrupted >= 1) reasons.push(`${interrupted} interrupted hour${interrupted === 1 ? " was" : "s were"} recorded; interruption must be less than 1 hour`);
  return reasons;
}

export function sleepDeprivationDC(daysWithoutLongRest, { base = 10, increase = 5 } = {}) {
  return Number(base) + Math.max(0, Number(daysWithoutLongRest) - 1) * Number(increase);
}
