import { resolveEncounterRoll } from "../domain/encounter-rules.mjs";
import { assignedWatchIndexes, campPeriods, campWatchAction, CAMP_WATCH_COUNT } from "../domain/camp-watch-rules.mjs";
import { nightEncountersEnabled } from "../core/journey-settings.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { campPerceptionRollService } from "../services/camp-perception-roll-service.mjs";
import { JourneyV14Application as BaseJourneyApplication } from "./journey-v14-app.mjs";
import { readCampAssignments } from "../ui/camp-assignment-controls.mjs";
import { displayJourneyRoll } from "../ui/journey-roll-display.mjs";
import { createNightEncounterInterruptions } from "../domain/night-interruption-rules.mjs";

export class JourneyFinalApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = { actions: { rollNightEncounter: this.rollNightEncounter } };

  static async rollNightEncounter(event) {
    event.preventDefault();
    const rollButton = event.target.closest("[data-action='rollNightEncounter']");
    if (rollButton) rollButton.disabled = true;
    try {
      const journey = await getActiveJourney();
      if (!nightEncountersEnabled(journey)) throw new Error("Night Encounters are disabled for this journey.");
      if (journey.currentDay?.nightEncounterCheck) throw new Error("The night encounter has already been rolled.");
      if (this.element.querySelector("select[name^='watchAction']")) journey.currentDay.campWatches = readCampAssignments(this.element, journey);
      const assignments = journey.currentDay?.campWatches ?? [];
      const watches = assignments.filter(watch => watch.actorUuid && assignedWatchIndexes(watch).length);
      const fireRequired = new Set(["Craft", "Cook", "Prepare"]);
      if (!journey.currentDay?.campfire && assignments.some(watch => campPeriods(watch).some(period => fireRequired.has(period.action)))) throw new Error("Craft, Cook, and Prepare require a campfire. Change those actions or light a fire.");
      const anyTent = journey.currentDay?.campSleepPlan?.entries?.some(entry => entry.equipment?.tent)
        || (journey.supplies?.items ?? []).some(item => item.category === "tent" && item.sourceType !== "group" && Number(item.availableQuantity ?? 0) > 0);
      const setupQuality = journey.currentDay?.campfire ? "excellent" : anyTent ? "ordinary" : "poor";
      const modifiers = [];
      if (setupQuality === "poor") modifiers.push({ id: "poorCamp", label: "Poor camp: no fire and no tents", value: 10 });
      else if (setupQuality === "excellent") modifiers.push({ id: "campfireCamp", label: "Campfire: excellent setup -10, visibility +5", value: -5 });
      const weather = journey.currentDay?.phases?.weather;
      const weatherLabel = String(weather?.generated?.label ?? "").toLowerCase();
      if (weather?.extreme || /rain|snow|storm|wind|flood|fog|overcast/.test(weatherLabel)) modifiers.unshift({ id: "badWeather", label: "Bad weather / low visibility", value: 5 });
      else if (/fair|clear|comfortable/.test(weatherLabel)) modifiers.unshift({ id: "favorableWeather", label: "Favorable weather", value: -5 });
      const roll = await new Roll("1d100").evaluate();
      const effectiveDanger = Math.max(0, Number(journey.routeSnapshot.danger ?? 0) - (journey.currentDay?.pace === "stopped" ? 1 : 0));
      const result = resolveEncounterRoll({ raw: Number(roll.total), danger: effectiveDanger, modifiers, night: true });
      result.routeDanger = Number(journey.routeSnapshot.danger ?? 0);
      result.stoppedDangerReduction = journey.currentDay?.pace === "stopped" ? -1 : 0;
      if (["minor", "nightAttack"].includes(result.outcome)) {
        const watchRoll = await new Roll(`1d${CAMP_WATCH_COUNT}`).evaluate();
        const watchIndex = Number(watchRoll.total) - 1;
        const selected = watches.find(entry => assignedWatchIndexes(entry).includes(watchIndex));
        Object.assign(result, { watchRoll: Number(watchRoll.total), watchIndex, watcherActorUuid: selected?.actorUuid ?? null, watcherActorName: selected?.actorName ?? "Unwatched", campAction: campWatchAction(selected, watchIndex) ?? null, unwatched: !selected });
        const travelerIds = new Set((journey.travelers ?? []).map(traveler => traveler.actorUuid));
        journey.currentDay.sleepInterruptions = (journey.currentDay.sleepInterruptions ?? []).filter(item => !travelerIds.has(item.actorUuid));
        journey.currentDay.sleepInterruptions.push(...createNightEncounterInterruptions(journey.travelers, { outcome: result.outcome, watchIndex }));
      }
      journey.currentDay.nightEncounterCheck = { ...result, setupQuality, campfire: Boolean(journey.currentDay?.campfire), pendingSleepConfirmation: true, rolledAt: Date.now() };
      await saveActiveJourney(journey);
      await displayJourneyRoll(roll, { flavor: `Morelord Journeys night encounter — ${result.outcome} (${result.modified})`, rollMode: "gmroll" });
      if (result.watcherActorUuid) {
        await campPerceptionRollService.request({ watchIndex: result.watchIndex, actorUuid: result.watcherActorUuid, action: result.campAction });
      }
      await this.render({ force: true });
    } catch (error) { if (rollButton) rollButton.disabled = false; ui.notifications.error(error.message); }
  }
}
