export const MODULE_ID = "morelord-journeys";
export const SCHEMA_VERSION = 1;
export const STEPS_PER_DAY = 3;

export const JOURNEY_STATUS = Object.freeze({
  PLANNING: "planning",
  READY: "ready",
  ACTIVE: "active",
  ARRIVED: "arrived",
  CANCELLED: "cancelled"
});

export const TRAVEL_PHASES = Object.freeze([
  "weather",
  "pace",
  "encounters",
  "discovery",
  "navigation",
  "pressOn",
  "foraging",
  "camp",
  "dayComplete"
]);

export const PACE_STEPS = Object.freeze({
  stopped: 0,
  slow: 2,
  normal: 3,
  fast: 4
});
