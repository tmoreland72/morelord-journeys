import { synchronizeExclusiveRoleSelects } from "./exclusive-role-controls.mjs";

export function readPlannerDefaults(element) {
  const defaults = { fields: {}, travelers: [], longRestHours: {} };
  for (const input of element.querySelectorAll("input[name], select[name], textarea[name]")) {
    if (input.name === "travelerUuid") {
      if (input.checked) defaults.travelers.push(input.value);
    } else if (input.name === "longRestHours") defaults.longRestHours[input.dataset.actorUuid] = input.value;
    else defaults.fields[input.name] = input.type === "checkbox" ? input.checked : input.value;
  }
  return defaults;
}

export function applyPlannerDefaults(element, defaults = {}) {
  const roles = new Set(["navigatorUuid", "observerUuid", "quartermasterUuid"]);
  const restore = input => {
    const value = defaults.fields?.[input.name];
    if (value === undefined) return;
    if (input.type === "checkbox") input.checked = Boolean(value);
    else if (!input.options || Array.from(input.options).some(option => option.value === value)) input.value = value;
  };
  const inputs = Array.from(element.querySelectorAll("input[name], select[name], textarea[name]"));
  for (const input of inputs) {
    if (input.name === "travelerUuid" && Array.isArray(defaults.travelers)) input.checked = defaults.travelers.includes(input.value);
    else if (input.name === "longRestHours") input.value = defaults.longRestHours?.[input.dataset.actorUuid] ?? input.value;
    else if (!roles.has(input.name)) restore(input);
  }
  // Rebuild role options from the restored party before selecting saved roles.
  element.querySelector(".ml-journeys-traveler-list")?.dispatchEvent(new Event("change", { bubbles: true }));
  for (const input of inputs.filter(input => roles.has(input.name))) restore(input);
  synchronizeExclusiveRoleSelects(element.querySelector('[name="navigatorUuid"]'), element.querySelector('[name="observerUuid"]'));
}
