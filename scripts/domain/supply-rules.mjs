export function hungerThreshold(conModifier) {
  return Math.max(0, 3 + Number(conModifier ?? 0));
}

export function hungerSaveDC(daysWithoutFood, conModifier, { base = 10, increase = 5 } = {}) {
  const threshold = hungerThreshold(conModifier);
  const hungryDaysBeyondThreshold = Number(daysWithoutFood) - threshold;
  return hungryDaysBeyondThreshold > 0 ? Number(base) + (hungryDaysBeyondThreshold - 1) * Number(increase) : null;
}
