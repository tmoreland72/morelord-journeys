import { assert } from "../../../morelord-core/scripts/testing/in-game.js";
import { createJourney } from "../domain/journey.mjs";
import { createRoute } from "../domain/route.mjs";
import { readyJourney, beginTravelDay } from "../domain/engine.mjs";

export const nightEncounterControlsCheck = { id: "journeys.night-encounter-controls", async run() {
  assert(game.user.isGM, "Run as GM in Dev1.");
  const moduleId = "morelord-journeys";
  const snapshot = Object.fromEntries(["activeJourney", "journeyUndo"].map(key => [key, structuredClone(game.settings.get(moduleId, key))]));
  const actor = await Actor.create({ name: "Journey night regression", type: "character" });
  const journey = beginTravelDay(readyJourney(createJourney({ id: foundry.utils.randomID(), route: createRoute({ id: foundry.utils.randomID(), origin: { name: "Night test" }, destination: { name: "Night test end" }, lengthSteps: 3 }), travelers: [{ actorUuid: actor.uuid, name: actor.name }], steps: { camp: true, nightEncounters: true, sleep: true } })));
  journey.phase = "camp"; journey.currentDay.pace = "normal";
  journey.currentDay.nightEncounterCheck = { method: "nightDice", danger: 5, dieFaces: 4, intervalHours: 2, results: [1, 1, 3, 3], triggers: 2, cancellations: 0, encounterCount: 2, encounters: [0, 1].map(index => ({ id: `encounter-${index}`, watchIndex: index, startHour: index * 2, endHour: index * 2 + 2, unwatched: true })) };
  const app = new MorelordJourneys.applications.JourneyApplication();
  const waitFor = async predicate => {
    const deadline = Date.now() + 15000;
    while (!predicate()) { assert(Date.now() < deadline, "Night encounter action must complete."); await new Promise(resolve => setTimeout(resolve, 50)); }
  };
  try {
    await game.settings.set(moduleId, "activeJourney", journey);
    await app.render({ force: true });
    const first = app.element.querySelector('[data-night-encounter-id="encounter-0"]');
    const duration = first.querySelector('[data-night-hours]');
    assert(duration.readOnly && duration.value === "1", "Duration must default to one hour and disallow typing.");
    first.querySelector('[data-night-increase]').click();
    await waitFor(() => game.settings.get(moduleId, "activeJourney").currentDay.sleepInterruptions?.some(entry => entry.encounterId === "encounter-0" && entry.hours === 2));
    const interruptions = game.settings.get(moduleId, "activeJourney").currentDay.sleepInterruptions;
    assert(interruptions.length === 2 && interruptions.every(entry => entry.count === 1 && entry.interruptsRest), "Each encounter must create its own timed rest interruption.");
    first.querySelector('[aria-label="Reject encounter"]').click();
    await waitFor(() => game.settings.get(moduleId, "activeJourney").currentDay.nightEncounterCheck.encounterCount === 1);
    await waitFor(() => !app.element.querySelector('[data-night-encounter-id="encounter-0"]'));
    const current = game.settings.get(moduleId, "activeJourney");
    assert(current.currentDay.sleepInterruptions.length === 1 && current.currentDay.sleepInterruptions[0].encounterId === "encounter-1", "Reject encounter must remove only its interruption.");
    assert(current.currentDay.nightEncounterCheck.results.join() === "1,1,3,3", "Rejected encounter dice must remain available for review.");
    current.currentDay.pendingCampPerceptionRolls = [{ id: foundry.utils.randomID(), actorUuid: actor.uuid }];
    await game.settings.set(moduleId, "activeJourney", current);
    const notifications = ui.notifications.error;
    let notice;
    try {
      ui.notifications.error = message => { notice = message; };
      const { JourneyApplication } = await import("../apps/journey-app.mjs");
      await JourneyApplication.advancePhase.call(app);
      assert(notice === "Resolve pending watch Perception checks before continuing.", "Resolve and Continue must explain a pending check without masking the error.");
    } finally { ui.notifications.error = notifications; }
  } finally {
    await app.close();
    for (const [key, value] of Object.entries(snapshot)) await game.settings.set(moduleId, key, value);
    for (const message of game.messages.contents.filter(message => message.flags?.[moduleId]?.journeyProgress?.journeyId === journey.id)) await message.delete();
    await actor.delete();
  }
} };
