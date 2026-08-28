export function naturalD20(roll) {
  const dice = Array.from(roll?.dice ?? []);
  const die = dice.find(candidate => Number(candidate?.faces) === 20);
  const active = Array.from(die?.results ?? []).filter(result => result?.active !== false && result?.discarded !== true);
  const value = Number(active.at(-1)?.result ?? die?.total);
  return Number.isInteger(value) && value >= 1 && value <= 20 ? value : null;
}
