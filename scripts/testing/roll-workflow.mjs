import { assert } from "../../../morelord-core/scripts/testing/in-game.js";
import { createJourney } from "../domain/journey.mjs";
import { createRoute } from "../domain/route.mjs";
import { readyJourney, beginTravelDay } from "../domain/engine.mjs";

export const rollWorkflowCheck = { id: "journeys.roll-workflow-and-duration", async run(capture = async () => {}) {
  const id = "morelord-journeys", api = game.modules.get(id).api;
  const snapshot = Object.fromEntries(["activeJourney", "journeyUndo", "skipDiceAnimation"].map(key => [key, foundry.utils.deepClone(game.settings.get(id, key))]));
  const actor = await Actor.create({ name: "Journey workflow fixture", type: "character" });
  const journeyId = foundry.utils.randomID();
  let app;
  try {
    const route = createRoute({ id: foundry.utils.randomID(), origin: { name: "Test start" }, destination: { name: "Test finish" }, lengthSteps: 16, danger: 0, discoveryDC: 10, resourcesDC: 10, navigationDC: 10 });
    let journey = readyJourney(createJourney({ id: journeyId, route, travelers: [{ actorId: actor.id, actorUuid: actor.uuid, name: actor.name }], steps: { nightEncounters: true } }));
    Object.assign(journey, { dayNumber: 6, progressSteps: 11, remainingSteps: 5, status: "active" });
    await game.settings.set(id, "activeJourney", journey);
    app = new api.applications.JourneyApplication({ id: "morelord-journeys-regression" });
    await app.render({ force: true });
    const statistics = [...app.element.querySelectorAll(".journey-progress-dashboard .ml-card strong")].map(node => node.textContent.trim());
    assert(JSON.stringify(statistics) === JSON.stringify(["6", "1⅔", "5⅓ days", "7⅔ days"]), "Day 7 distinguishes six elapsed days from route distance and updates the total estimate.");
    await capture(app.element.id);
    journey = beginTravelDay(journey);
    journey.phase = "foraging";
    journey.currentDay.pace = "normal";
    journey.currentDay.pendingForagingRolls = [{ id: foundry.utils.randomID(), actorUuid: actor.uuid, actorName: actor.name, dc: 10 }];
    await game.settings.set(id, "activeJourney", journey);
    await app.render({ force: true });
    assert(!app.element.querySelector('[data-action="resendForagingRoll"], [data-action="autoForagingFailure"], [data-action="autoForagingSuccess"]'), "Foraging has no obsolete Resend, Fail, or Succeed controls.");
    journey.phase = "camp";
    journey.currentDay.campWatches = [];
    await game.settings.set(id, "activeJourney", journey);
    await game.settings.set(id, "skipDiceAnimation", false);
    await app.render({ force: true });
    const button = app.element.querySelector('[data-action="rollNightEncounter"]');
    assert(button?.textContent.includes("Roll Night Encounter"), "Night encounters expose the direct GM roll action.");
    button.click();
    const end = Date.now() + 60000;
    while (!game.settings.get(id, "activeJourney")?.currentDay?.nightEncounterCheck && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 50));
    assert(game.settings.get(id, "activeJourney").currentDay.nightEncounterCheck, "The GM action resolves the night directly.");
    assert(!game.messages.some(message => message.getFlag("morelord-core", "rollRequest")?.data?.journeyId === journeyId), "Night rolls do not create a player request card.");
    const message = game.messages.find(message => message.getFlag(id, "journeyRoll")?.journeyId === journeyId);
    assert(message && !message._dice3danimating, "The night outcome appears after its dice animation completes.");
    assert(message.whisper.length > 0 && message.whisper.every(userId => game.users.get(userId)?.isGM), "Night dice remain GM-only.");
  } finally {
    await app?.close();
    for (const [key, value] of Object.entries(snapshot)) await game.settings.set(id, key, value);
    const ids = game.messages.filter(message => {
      const request = message.getFlag("morelord-core", "rollRequest");
      return message.getFlag(id, "journeyRoll")?.journeyId === journeyId || request?.data?.journeyId === journeyId || Object.values(request?.entries ?? {}).some(entry => entry.data?.journeyId === journeyId);
    }).map(message => message.id);
    if (ids.length) await ChatMessage.deleteDocuments(ids);
    await actor.delete();
  }
} };
