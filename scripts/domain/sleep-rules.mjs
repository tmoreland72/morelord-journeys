export function qualifiesForLongRest({ sleepCheckSucceeded, sleepHours, interruptionHours, interruptionMinutes }) {
  const interrupted = interruptionHours == null ? Number(interruptionMinutes ?? 0) / 60 : Number(interruptionHours);
  return Boolean(sleepCheckSucceeded) && Number(sleepHours) >= 6 && interrupted < 1;
}

export function sleepDeprivationDC(daysWithoutLongRest) {
  return 10 + Math.max(0, Number(daysWithoutLongRest) - 1) * 5;
}
