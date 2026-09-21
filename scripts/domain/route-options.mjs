export const DISCOVERY_OPTIONS = Object.freeze([
  { value: 5, label: "Very likely — DC 5" },
  { value: 10, label: "Likely — DC 10" },
  { value: 15, label: "Possible — DC 15" },
  { value: 20, label: "Unlikely — DC 20" },
  { value: 25, label: "Very unlikely — DC 25" }
]);

export const RESOURCE_OPTIONS = Object.freeze([
  { value: 5, label: "Lush forest or meadow — DC 5" },
  { value: 10, label: "Productive woodland or grassland — DC 10" },
  { value: 15, label: "Typical mixed wilderness — DC 15" },
  { value: 20, label: "Traveled or heavily settled land — DC 20" },
  { value: 25, label: "Desert, tundra, or sparse badlands — DC 25" },
  { value: 30, label: "Barren or extreme environment — DC 30" }
]);

export const NAVIGATION_OPTIONS = Object.freeze([
  { value: 5, label: "Simple — DC 5" },
  { value: 10, label: "Routine — DC 10" },
  { value: 15, label: "Normal — DC 15" },
  { value: 20, label: "Challenging — DC 20" },
  { value: 25, label: "Very challenging — DC 25" },
  { value: 30, label: "Extreme — DC 30" }
]);

export function routeOptionsWithDCs(options, values = []) {
  return options.map((option, index) => {
    const value = Number(values[index] ?? option.value);
    const description = option.label.replace(/\s+—\s+DC\s+\d+$/i, "");
    return { value, label: `${description} — DC ${value}` };
  });
}

export const DANGER_OPTIONS = Object.freeze([
  { value: 0, label: "Minimal danger — d20" },
  { value: 1, label: "Safe or civilized — d12" },
  { value: 2, label: "Untamed wilderness — d10" },
  { value: 3, label: "Hostile territory — d8" },
  { value: 4, label: "Extremely dangerous — d6" },
  { value: 5, label: "Lethal or otherworldly — d4" }
]);

export const LENGTH_OPTIONS = Object.freeze(
  Array.from({ length: 101 }, (_, index) => ({
    value: index,
    label: `${index} ${index === 1 ? "day" : "days"}`
  }))
);

export const LENGTH_THIRD_OPTIONS = Object.freeze([
  { value: 0, label: "No additional thirds" },
  { value: 1, label: "+ ⅓ day" },
  { value: 2, label: "+ ⅔ day" }
]);
