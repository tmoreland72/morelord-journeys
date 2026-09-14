export function hungerThreshold() { return 5; }

export function hungerSaveDC(daysWithoutFood, conModifier, { base = 10 } = {}) {
  return daysWithoutFood > 0 && daysWithoutFood < hungerThreshold() ? Number(base) : null;
}
