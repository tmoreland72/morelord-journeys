import test from "node:test";
import assert from "node:assert/strict";
import { readPlannerDefaults, applyPlannerDefaults } from "../../scripts/ui/journey-planner-defaults.mjs";

const field = (name, value, extra = {}) => ({ name, value, type: "text", ...extra });
const form = inputs => ({
  querySelectorAll: () => inputs,
  querySelector: selector => inputs.find(input => selector === `[name="${input.name}"]`) ?? null
});

test("planner defaults round-trip all fields, unchecked steps, party selections and individual rest hours", () => {
  const inputs = [
    ...Object.entries({ journeyName: "Homeward", routeName: "Coast", origin: "Port", destination: "Home", lengthDays: "8", lengthThirds: "2", danger: "3", discoveryDC: "20", resourcesDC: "15", navigationDC: "10", routeTraffic: "high", activityHoursPerDay: "2.5" }).map(([name, value]) => field(name, value)),
    field("step-weather", "on", { type: "checkbox", checked: false }),
    field("travelerUuid", "a", { type: "checkbox", checked: true }),
    field("travelerUuid", "b", { type: "checkbox", checked: false }),
    field("longRestHours", "4", { dataset: { actorUuid: "a" } }),
    field("longRestHours", "6", { dataset: { actorUuid: "b" } }),
    field("navigatorUuid", "a", { options: [{ value: "a" }, { value: "c" }] }),
    field("observerUuid", "c", { options: [{ value: "a" }, { value: "c" }] })
  ];
  const defaults = readPlannerDefaults(form(inputs));
  assert.deepEqual(defaults.travelers, ["a"]);
  assert.deepEqual(defaults.longRestHours, { a: "4", b: "6" });
  assert.equal(defaults.fields.activityHoursPerDay, "2.5");
  for (const input of inputs) {
    if (input.type === "checkbox") input.checked = !input.checked;
    else input.value = "changed";
  }
  applyPlannerDefaults(form(inputs), defaults);
  assert.deepEqual(readPlannerDefaults(form(inputs)), defaults);
});

test("saved roles are restored after rebuilding party options; missing actors do not blank valid roles", () => {
  const navigator = field("navigatorUuid", "a", { options: [{ value: "a" }, { value: "b" }] });
  const observer = field("observerUuid", "b", { options: [{ value: "a" }, { value: "b" }] });
  const element = form([navigator, observer]);
  const query = element.querySelector;
  element.querySelector = selector => selector === ".ml-journeys-traveler-list" ? { dispatchEvent() { navigator.value = "a"; observer.value = "b"; } } : query(selector);
  applyPlannerDefaults(element, { fields: { navigatorUuid: "b", observerUuid: "a" } });
  assert.equal(navigator.value, "b");
  assert.equal(observer.value, "a");
  applyPlannerDefaults(element, { fields: { navigatorUuid: "deleted", observerUuid: "deleted" } });
  assert.equal(navigator.value, "a");
  assert.equal(observer.value, "b");
});
