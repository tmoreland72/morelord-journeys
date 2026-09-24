import { resolveNightDice, dangerDie, nightEncounterTiming } from "../domain/encounter-rules.mjs";
import { assignedWatchIndexes, campPeriods, campWatchAction } from "../domain/camp-watch-rules.mjs";
import { nightEncountersEnabled, getNightCheckInterval } from "../core/journey-settings.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { campPerceptionRollService } from "../services/camp-perception-roll-service.mjs";
import { JourneyV14Application as BaseJourneyApplication } from "./journey-v14-app.mjs";
import { readCampAssignments } from "../ui/camp-assignment-controls.mjs";
import { displayJourneyRoll } from "../ui/journey-roll-display.mjs";
import { JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";

let rollingNight = false;

export class JourneyFinalApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = { actions: { rollNightEncounter: this.rollNightEncounter } };

  static async rollNightEncounter(event) {
    event.preventDefault();
    if (rollingNight) return;
    rollingNight = true;
    const rollButton = event.target.closest("[data-action='rollNightEncounter']");
    if (rollButton) rollButton.disabled = true;
    try {
      if (!game.user.isGM) throw new Error("Only the GM can roll night encounters.");
      const journey = await getActiveJourney();
      if (journey?.phase !== "camp") throw new Error("Night encounters can only be rolled during Camp.");
      if (!nightEncountersEnabled(journey)) throw new Error("Night Encounters are disabled for this journey.");
      if (journey.currentDay?.nightEncounterCheck) throw new Error("The night encounter has already been rolled.");
      if (this.element.querySelector("select[name^='watchAction']")) journey.currentDay.campWatches = readCampAssignments(this.element, journey);
      const assignments = journey.currentDay?.campWatches ?? [];
      const watches = assignments.filter(watch => watch.actorUuid && assignedWatchIndexes(watch).length);
      const fireRequired = new Set(["Craft", "Cook", "Prepare"]);
      if (!journey.currentDay?.campfire && assignments.some(watch => campPeriods(watch).some(period => fireRequired.has(period.action)))) throw new Error("Craft, Cook, and Prepare require a campfire. Change those actions or light a fire.");
      const danger = Number(journey.routeSnapshot.danger);
      const intervalHours = getNightCheckInterval();
      const roll = await new Roll((8 / intervalHours) + "d" + dangerDie(danger)).evaluate({ allowInteractive: false });
      const results = roll.dice.flatMap(die => die.results.filter(entry => entry.active !== false).map(entry => entry.result));
      const result = resolveNightDice({ danger, results, intervalHours, campfire: Boolean(journey.currentDay.campfire) });
      for (const encounter of result.encounters) {
        const selected = watches.find(entry => assignedWatchIndexes(entry).includes(encounter.watchIndex));
        Object.assign(encounter, { watcherActorUuid: selected?.actorUuid ?? null, watcherActorName: selected?.actorName ?? "Unwatched", campAction: campWatchAction(selected, encounter.watchIndex) ?? null, unwatched: !selected });
      }
      journey.currentDay.nightEncounterCheck = { ...result, pendingSleepConfirmation: true, rolledAt: Date.now() };
      try {
        await displayJourneyRoll(roll, { flavor: "Morelord Journeys night checks — " + result.encounterCount + " encounter(s)" + (result.encounters.length ? ": " + result.encounters.map(nightEncounterTiming).join("; ") : ""), flags: { "morelord-journeys": { journeyRoll: { journeyId: journey.id, dayNumber: journey.dayNumber, kind: "night" } } } }, { messageMode: "gm" });
      } catch (error) { console.error("Night chat display failed; recording the results.", error); }
      await saveActiveJourney(journey);
      await this.render({ force: true });
      const requested = new Set();
      for (const encounter of result.encounters) {
        if (!encounter.watcherActorUuid || requested.has(encounter.watchIndex)) continue;
        requested.add(encounter.watchIndex);
        await campPerceptionRollService.request({ watchIndex: encounter.watchIndex, actorUuid: encounter.watcherActorUuid, action: encounter.campAction });
      }
      await this.render({ force: true });
    } catch (error) { if (rollButton) rollButton.disabled = false; if(event.fromChat) throw error; ui.notifications.error(error.message); }
    finally { rollingNight = false; }
  }
}

export function registerNightEncounterRequests() { MorelordCore.chatRequests.register("journeys.night", async data => {
  const journey=await getActiveJourney();
  if(journey?.id!==data.journeyId || journey.dayNumber!==data.dayNumber || journey.phase!=="camp" || journey.currentDay?.nightEncounterCheck) return {accepted:false,reason:"This night encounter request is no longer pending."};
  await JourneyFinalApplication.rollNightEncounter.call({element:document.createElement("div"),render:async()=>{}},{fromChat:true,preventDefault(){},target:document.createElement("button")});
  return {accepted:true};
},{serialize:JOURNEY_STATE_SERIAL_KEY}); }
