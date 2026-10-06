import { assert } from "../../../morelord-core/scripts/testing/in-game.js";
import { MODULE_ID } from "../domain/constants.mjs";
import { SavedJourneyManager } from "../apps/saved-journey-manager.mjs";
import { JourneyExpeditionApplication } from "../apps/journey-expedition-app.mjs";
import { readPlannerDefaults } from "../ui/journey-planner-defaults.mjs";

const waitFor = async predicate => {
  const deadline = Date.now() + 15000;
  while (!predicate()) {
    assert(Date.now() < deadline, "Journey UI action must complete.");
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};

export function savedJourneysCheck(onRendered = async () => {}) {
  return { id: "journeys.saved-setups", async run() {
    assert(game.user.isGM, "Run as GM in Dev1.");
    const name = `Journey regression ${foundry.utils.randomID()}`;
    const active = structuredClone(game.settings.get(MODULE_ID, "activeJourney"));
    const undo = structuredClone(game.settings.get(MODULE_ID, "journeyUndo"));
    const defaults = JSON.stringify(game.settings.get(MODULE_ID, "journeyPlannerDefaults"));
    const readSaved = () => game.settings.get(MODULE_ID, "savedJourneys");
    const app = new MorelordJourneys.applications.JourneyApplication();
    let manager, entryId;
    try {
      await game.settings.set(MODULE_ID, "activeJourney", null);
      await app.render({ force: true });
      const field = key => app.element.querySelector(`[name="${key}"]`);
      field("origin").value = "Neverwinter";
      field("destination").value = "Phandalin";
      field("lengthDays").value = "3";
      field("step-weather").checked = false;
      const expected = readPlannerDefaults(app.element);
      app.element.querySelector('[data-action="saveJourneySetup"]').click();
      await waitFor(() => document.querySelector('[name="journeyName"]'));
      const input = document.querySelector('[name="journeyName"]');
      input.value = name;
      input.closest("form").querySelector('[data-action="ok"]').click();
      await waitFor(() => readSaved().entries.some(entry => entry.name === name));
      const entry = readSaved().entries.find(entry => entry.name === name);
      entryId = entry.id;
      assert(JSON.stringify(entry.setup) === JSON.stringify(expected), "Saved setup must retain planner fields, steps, party, roles, and rest hours.");
      assert(!("supplies" in entry.setup), "Saved setups must not store inventory quantities.");
      assert(app.element.querySelector('[data-action="selectJourneySetup"]'), "Saving must expose Choose Saved Journey without resetting the planner.");
      field("origin").value = "Changed";
      manager = new SavedJourneyManager({ choose: selected => JourneyExpeditionApplication.loadJourneySetup.call(app, selected) });
      manager.selectedId = entryId;
      await manager.render({ force: true });
      await onRendered(manager);
      manager.element.querySelector('[data-action="choose"]').click();
      await waitFor(() => !manager.rendered);
      assert(field("origin").value === "Neverwinter" && !field("step-weather").checked, "Select Journey must restore route and disabled steps.");
      assert(game.settings.get(MODULE_ID, "activeJourney") === null, "Loading a setup must not begin travel.");
      assert(JSON.stringify(game.settings.get(MODULE_ID, "journeyPlannerDefaults")) === defaults, "Named setups must leave world defaults unchanged.");
      manager = new SavedJourneyManager(); manager.selectedId = entryId;
      await manager.render({ force: true });
      manager.element.querySelector('[name="name"]').value = name + " renamed";
      manager.element.querySelector('[data-action="save"]').click();
      await waitFor(() => !manager.rendered);
      assert(readSaved().entries.find(saved => saved.id === entryId)?.name === name + " renamed", "Save Journey must rename the same preset.");
      manager = new SavedJourneyManager(); manager.selectedId = entryId;
      await manager.render({ force: true });
      manager.element.querySelector('[data-action="delete"]').click();
      await waitFor(() => !manager.rendered);
      assert(!readSaved().entries.some(saved => saved.id === entryId), "Delete must remove the selected preset.");
    } finally {
      await manager?.close(); await app.close();
      const saved = structuredClone(readSaved());
      saved.entries = saved.entries.filter(entry => entry.id !== entryId && entry.name !== name);
      await game.settings.set(MODULE_ID, "savedJourneys", saved);
      await game.settings.set(MODULE_ID, "activeJourney", active);
      await game.settings.set(MODULE_ID, "journeyUndo", undo);
    }
  } };
}
