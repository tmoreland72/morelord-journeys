import { resolveEncounterRoll } from "../domain/encounter-rules.mjs";
import { nightEncountersEnabled } from "../core/journey-settings.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { campPerceptionRollService } from "../services/camp-perception-roll-service.mjs";
import { JourneyV14Application as BaseJourneyApplication } from "./journey-v14-app.mjs";

export class JourneyFinalApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = { actions: { rollNightEncounter: this.rollNightEncounter } };

  static async rollNightEncounter(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      if (!nightEncountersEnabled()) throw new Error("Night Encounters are disabled in Journeys Settings.");
      const watches = (journey.currentDay?.campWatches ?? []).filter(watch => watch.actorUuid);
      if (!watches.length) throw new Error("Assign at least one watch before rolling the night encounter.");
      const fireRequired = new Set(["Craft", "Cook", "Prepare"]);
      if (!journey.currentDay?.campfire && watches.some(watch => fireRequired.has(watch.action))) throw new Error("Craft, Cook, and Prepare require a campfire. Change those actions or light a fire.");
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
      if (journey.routeSnapshot?.traffic === "high") modifiers.unshift({ id: "road", label: "Road / high traffic", value: 5 });
      const roll = await new Roll("1d100").evaluate();
      const effectiveDanger = Math.max(0, Number(journey.routeSnapshot.danger ?? 0) - (journey.currentDay?.pace === "stopped" ? 1 : 0));
      const result = resolveEncounterRoll({ raw: Number(roll.total), danger: effectiveDanger, modifiers, night: true });
      result.routeDanger = Number(journey.routeSnapshot.danger ?? 0);
      result.stoppedDangerReduction = journey.currentDay?.pace === "stopped" ? -1 : 0;
      if (["minor", "nightAttack"].includes(result.outcome)) {
        const watchRoll = await new Roll(`1d${watches.length}`).evaluate();
        const selected = watches[Number(watchRoll.total) - 1];
        Object.assign(result, { watchRoll: Number(watchRoll.total), watchIndex: selected.index, watcherActorUuid: selected.actorUuid, watcherActorName: selected.actorName, campAction: selected.action });
        if (result.outcome === "nightAttack") {
          journey.currentDay.sleepInterruptions ??= [];
          journey.currentDay.sleepInterruptions = journey.currentDay.sleepInterruptions.filter(item => item.actorUuid !== selected.actorUuid);
          journey.currentDay.sleepInterruptions.push({ actorUuid: selected.actorUuid, actorName: selected.actorName, watchIndex: selected.index, reason: "combat", suggestedHours: 1, hours: 1, recordedAt: Date.now() });
        }
      }
      journey.currentDay.nightEncounterCheck = { ...result, setupQuality, campfire: Boolean(journey.currentDay?.campfire), pendingSleepConfirmation: true, rolledAt: Date.now() };
      await saveActiveJourney(journey);
      await roll.toMessage({ flavor: `Morelord Journeys night encounter — ${result.outcome} (${result.modified})`, rollMode: "gmroll" });
      if (result.watcherActorUuid) {
        if (result.campAction === "Slumber") {
          const current = await getActiveJourney();
          current.currentDay.campPerceptionResults ??= [];
          current.currentDay.campPerceptionResults.push({ watchIndex: result.watchIndex, actorUuid: result.watcherActorUuid, actorName: result.watcherActorName, total: 0, automatic: true, action: "Slumber", resolvedAt: Date.now() });
          await saveActiveJourney(current);
        } else await campPerceptionRollService.request({ watchIndex: result.watchIndex, actorUuid: result.watcherActorUuid, action: result.campAction });
      }
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }
}
