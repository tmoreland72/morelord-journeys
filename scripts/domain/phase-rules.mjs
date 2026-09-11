export function phaseSkipReason({ phase, pace, enabled = true } = {}) {
  if (!enabled) return "Disabled for this journey";
  if (pace === "stopped" && ["encounters", "discovery", "navigation", "pressOn"].includes(phase)) return "Skipped because travel pace is Stopped";
  return null;
}
