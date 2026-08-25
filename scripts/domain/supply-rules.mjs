export function hungerThreshold(conModifier) {
  return Math.max(0, 3 + Number(conModifier ?? 0));
}

export function hungerSaveDC(daysWithoutFood, conModifier) {
  const threshold = hungerThreshold(conModifier);
  const hungryDaysBeyondThreshold = Number(daysWithoutFood) - threshold;
  return hungryDaysBeyondThreshold > 0 ? 10 + (hungryDaysBeyondThreshold - 1) * 5 : null;
}
