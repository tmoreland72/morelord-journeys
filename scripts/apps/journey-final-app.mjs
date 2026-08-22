import { getEncounterDie } from "../core/journey-settings.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { JourneyV14Application as BaseJourneyApplication } from "./journey-v14-app.mjs";

const dieFaces = die => Number(String(die).replace(/^d/, ""));

export class JourneyFinalApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = { actions: { rollCampWatch: this.rollCampWatch } };

  static async rollCampWatch(event, target) {
    event.preventDefault();
    try {
      const index = Number(target.dataset.watchIndex);
      const journey = await getActiveJourney();
      if (!journey.currentDay.campWatches?.length) throw new Error("Save the watch order before rolling watches.");
      const danger = Number(journey.routeSnapshot.danger ?? 0);
      const die = getEncounterDie();
      const roll = danger ? await new Roll(`${danger}${die}`).evaluate() : null;
      const results = roll ? roll.dice.flatMap(term => term.results.filter(result => result.active !== false).map(result => result.result)) : [];
      const encounterCount = results.filter(result => result === 1).length;
      const boonCount = results.filter(result => result === dieFaces(die)).length;
      journey.currentDay.campWatches[index].encounterRoll = { die, danger, results, encounterCount, boonCount, rolledAt: Date.now() };
      await saveActiveJourney(journey);
      if (roll) await roll.toMessage({ flavor: `Morelord Journeys — Camp Watch ${index + 1} · ${encounterCount} complications, ${boonCount} boons` });
      await ChatMessage.create({ speaker: { alias: "Morelord Journeys" }, content: `<article class="ml-chat-card ml-journeys-chat-card"><header><i class="fa-solid fa-moon"></i><strong>Watch ${index + 1} Complete</strong></header><p>${encounterCount} complication${encounterCount === 1 ? "" : "s"} and ${boonCount} boon${boonCount === 1 ? "" : "s"} during ${foundry.utils.escapeHTML(journey.currentDay.campWatches[index].actorName)}'s watch.</p></article>` });
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }
}
