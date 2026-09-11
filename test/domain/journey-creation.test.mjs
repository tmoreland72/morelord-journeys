import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: base => base } }, utils: { escapeHTML: value => value } };
const { JourneyRoleRefinementApplication } = await import("../../scripts/apps/journey-role-refinement-app.mjs");
const { JourneyApplication } = await import("../../scripts/apps/journey-app.mjs");

test("active creation handler persists excluded steps and daily travel skips them", async () => {
  const settings = new Map([["activeJourney", null]]);
  const actors = ["a", "b"].map(id => ({ id, uuid: `Actor.${id}`, name: id, type: "character", items: [] }));
  globalThis.game = {
    actors, user: { isGM: true }, i18n: { localize: key => key },
    settings: { get: (_, key) => settings.get(key), set: async (_, key, value) => settings.set(key, structuredClone(value)) }
  };
  globalThis.ChatMessage = { create: async () => {} };
  globalThis.fromUuid = async uuid => actors.find(actor => actor.uuid === uuid);
  const errors = [];
  globalThis.ui = { notifications: { info() {}, error: message => errors.push(message) } };
  const fields = { journeyName: "Test journey", routeName: "Test route", origin: "A", destination: "B", lengthDays: "2", lengthThirds: "0", navigatorUuid: "Actor.a", observerUuid: "Actor.b", activityHoursPerDay: "2.5" };
  const app = {
    element: {
      querySelector: selector => {
        const name = selector.match(/name=["']([^"']+)/)?.[1];
        if (name?.startsWith("step-")) return { checked: !["step-weather", "step-pace", "step-encounters"].includes(name) };
        return fields[name] === undefined ? null : { value: fields[name] };
      },
      querySelectorAll: selector => selector.includes("travelerUuid") ? actors.map(actor => ({ value: actor.uuid }))
        : selector.includes("longRestHours") ? actors.map(actor => ({ dataset: { actorUuid: actor.uuid }, value: "4" })) : []
    },
    render: async () => {}
  };
  await JourneyRoleRefinementApplication.DEFAULT_OPTIONS.actions.createJourney.call(app, { preventDefault() {} });
  assert.deepEqual(errors, []);
  const journey = settings.get("activeJourney");
  assert.equal(journey.steps.weather, false);
  assert.equal(journey.steps.encounters, false);
  assert.equal(journey.activityHoursPerDay, 2.5);
  assert.equal(journey.travelers[0].longRestHours, 4);
  await JourneyApplication.DEFAULT_OPTIONS.actions.beginDay.call(app);
  const started = settings.get("activeJourney");
  assert.equal(started.phase, "discovery");
  for (const phase of ["weather", "pace", "encounters"]) assert.equal(started.currentDay.phases[phase].skipped, true);
});
