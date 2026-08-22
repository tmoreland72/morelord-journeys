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

export const DANGER_OPTIONS = Object.freeze([
  { value: 0, label: "None — no encounter checks" },
  { value: 1, label: "Safe or civilized — 1 check/day" },
  { value: 2, label: "Untamed wilderness — 2 checks/day" },
  { value: 3, label: "Hostile territory — 3 checks/day" },
  { value: 4, label: "Extremely dangerous — 4 checks/day" },
  { value: 5, label: "Lethal or otherworldly — 5 checks/day" }
]);

export const LENGTH_OPTIONS = Object.freeze(
  Array.from({ length: 100 }, (_, index) => ({
    value: index + 1,
    label: `${index + 1} ${index === 0 ? "day" : "days"}`
  }))
);
