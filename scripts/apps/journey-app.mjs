import { TRAVEL_PHASES } from "../domain/constants.mjs";
import { addProgressModifier, beginTravelDay, completeTravelDay, readyJourney, recordPhase } from "../domain/engine.mjs";
import { createJourney } from "../domain/journey.mjs";
import { createRoute } from "../domain/route.mjs";
import { clearActiveJourney, getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const value = (element, name) => element.querySelector(`[name="${name}"]`)?.value ?? "";
const checked = (element, name) => element.querySelector(`[name="${name}"]`)?.checked ?? false;
const integer = (element, name, fallback = 0) => {
  const parsed = Number.parseInt(value(element, name), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

export class JourneyApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "morelord-journeys-dashboard",
      classes: ["ml-window", "ml-journeys-module"],
    position: { width: 720, height: "auto" },
    window: { title: "MORELORD_JOURNEYS.Name", icon: "fa-solid fa-compass" },
    actions: {
      createJourney: this.#createJourney,
      beginDay: this.#beginDay,
      advancePhase: this.#advancePhase,
      completeDay: this.#completeDay,
      clearJourney: this.#clearJourney,
      rollWeather: this.#rollWeather
    }
  };

  static PARTS = {
    content: { template: "modules/morelord-journeys/templates/journey-app.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const journey = await getActiveJourney();
    if (!journey) return { ...context, hasJourney: false };
    const length = journey.routeSnapshot.lengthSteps + Math.max(0, Number(journey.routeExtensionDays ?? 0)) * 3;
    const phase = journey.phase;
    const phaseIndex = phase ? TRAVEL_PHASES.indexOf(phase) : -1;
    return {
      ...context,
      hasJourney: true,
      journey,
      route: journey.routeSnapshot,
      isArrived: journey.status === "arrived",
      canBeginDay: journey.status === "ready" || (journey.status === "active" && !journey.currentDay),
      isDayComplete: phase === "dayComplete",
      progress: {
        current: journey.progressSteps,
        total: length,
        percent: length ? Math.min(100, Math.round((journey.progressSteps / length) * 100)) : 0,
        daysCurrent: Math.floor(journey.progressSteps / 3),
        daysTotal: Math.ceil(length / 3),
        originalDaysTotal: Math.ceil(journey.routeSnapshot.lengthSteps / 3),
        extended: Number(journey.routeExtensionDays ?? 0) > 0
      },
      phases: TRAVEL_PHASES.slice(0, -1).map((name, index) => ({
        name,
        label: game.i18n.localize(`MORELORD_JOURNEYS.Phases.${name}`),
        active: name === phase,
        complete: phaseIndex > index || phase === "dayComplete"
      })),
      phaseLabel: phase ? game.i18n.localize(`MORELORD_JOURNEYS.Phases.${phase}`) : "",
      phaseIs: Object.fromEntries(TRAVEL_PHASES.map(name => [name, phase === name])),
      weather: journey.currentDay?.generatedWeather ?? null,
      recentLog: journey.log.filter(entry => entry.type !== "progressModifierAdded").slice(-12).reverse().map(entry => ({
        ...entry,
        label: entry.type === "phaseRecorded"
          ? game.i18n.localize(`MORELORD_JOURNEYS.Phases.${entry.data.phase}`)
          : game.i18n.localize(`MORELORD_JOURNEYS.Log.${entry.type}`),
        result: JourneyApplication.#formatLogResult(entry)
      }))
    };
  }

  static async #createJourney() {
    try {
      const route = createRoute({
        id: crypto.randomUUID(),
        name: value(this.element, "routeName"),
        origin: { name: value(this.element, "origin") },
        destination: { name: value(this.element, "destination") },
        lengthSteps: integer(this.element, "lengthDays", 1) * 3,
        danger: integer(this.element, "danger", 1),
        discoveryDC: integer(this.element, "discoveryDC", 15),
        resourcesDC: integer(this.element, "resourcesDC", 15),
        navigationDC: integer(this.element, "navigationDC", 10)
      });
      const journey = readyJourney(createJourney({
        id: crypto.randomUUID(),
        name: value(this.element, "journeyName"),
        route
      }));
      await saveActiveJourney(journey);
      ui.notifications.info(game.i18n.localize("MORELORD_JOURNEYS.Notifications.Created"));
      await this.render({ force: true });
    } catch (error) {
      this.#notifyError(error);
    }
  }

  static async #beginDay() {
    try {
      await saveActiveJourney(beginTravelDay(await getActiveJourney()));
      await this.render({ force: true });
    } catch (error) {
      this.#notifyError(error);
    }
  }

  static async #advancePhase() {
    try {
      const source = await getActiveJourney();
      const phase = source.phase;
      let result = {};
      if (phase === "weather") result = {
        extreme: checked(this.element, "extremeWeather"),
        cold: Boolean(source.currentDay?.generatedWeather?.cold),
        generated: source.currentDay?.generatedWeather ?? null
      };
      if (phase === "pace") result = { pace: value(this.element, "pace") || "normal" };
      if (phase === "encounters") result = { count: Number(source.currentDay?.encounterCheck?.encounterCount ?? 0) };
      if (phase === "discovery") result = { pursued: checked(this.element, "pursueDiscovery") };
      if (phase === "foraging") result = { resolution: source.currentDay?.foragingResolution ?? null };
      if (phase === "navigation") result = { outcome: value(this.element, "navigationOutcome") || "success" };
      if (phase === "pressOn") result = { pressedOn: checked(this.element, "pressedOn") };
      if (phase === "camp") result = { watches: source.currentDay?.campWatches ?? [], sleep: source.currentDay?.campSleepResults ?? [] };

      let journey = recordPhase(source, phase, result);
      if (phase === "weather" && result.extreme) journey = addProgressModifier(journey, { id: "extreme-weather", label: "Extreme weather", steps: -1 });
      if (phase === "discovery" && result.pursued) journey = addProgressModifier(journey, { id: "discovery-diversion", label: "Discovery diversion", steps: -1 });
      if (phase === "pressOn" && result.pressedOn) journey = addProgressModifier(journey, { id: "press-on", label: "Pressed on", steps: 1 });
      await saveActiveJourney(journey);
      await this.render({ force: true });
    } catch (error) {
      this.#notifyError(error);
    }
  }

  static async #completeDay() {
    try {
      const journey = completeTravelDay(await getActiveJourney());
      await saveActiveJourney(journey);
      const key = journey.status === "arrived" ? "Arrived" : "DayComplete";
      ui.notifications.info(game.i18n.localize(`MORELORD_JOURNEYS.Notifications.${key}`));
      await this.render({ force: true });
    } catch (error) {
      this.#notifyError(error);
    }
  }

  static async #clearJourney() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("MORELORD_JOURNEYS.Clear.Title") },
      content: `<p>${game.i18n.localize("MORELORD_JOURNEYS.Clear.Content")}</p>`
    });
    if (!confirmed) return;
    await clearActiveJourney();
    await this.render({ force: true });
  }

  static async #rollWeather(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      const roll = await new Roll("1d20").evaluate();
      const total = Number(roll.total);
      const weather = total === 1
        ? { label: "Extreme cold", detail: "Bitter cold and dangerous exposure.", extreme: true, cold: true }
        : total === 20
          ? { label: "Extreme heat", detail: "Oppressive heat and dangerous exposure.", extreme: true, cold: false }
          : total <= 4
            ? { label: "Cold snap", detail: "Cold conditions; blankets help at camp.", extreme: false, cold: true }
            : total <= 8
              ? { label: "Rain or snow", detail: "Wet weather and reduced visibility.", extreme: false, cold: total <= 6 }
              : total <= 12
                ? { label: "Overcast", detail: "Cloud cover with otherwise ordinary travel.", extreme: false, cold: false }
                : total <= 17
                  ? { label: "Fair weather", detail: "Clear, comfortable traveling conditions.", extreme: false, cold: false }
                  : { label: "Strong winds", detail: "Gusting winds make travel difficult.", extreme: false, cold: false };
      journey.currentDay.generatedWeather = { ...weather, roll: total, rolledAt: Date.now() };
      await saveActiveJourney(journey);
      await this.render({ force: true });
    } catch (error) {
      console.error("morelord-journeys | Weather generation failed", error);
      ui.notifications.error(error.issues?.join("; ") ?? error.message);
    }
  }

  static #formatLogResult(entry) {
    if (entry.type === "dayCompleted") return `${entry.data.applied ?? 0} step(s) applied; ${entry.data.total ?? 0} total`;
    if (entry.type !== "phaseRecorded") return "";
    const result = entry.data?.result ?? {};
    const phase = entry.data?.phase;
    if (phase === "weather") return result.generated ? `${result.generated.label}${result.extreme ? " (extreme)" : ""}` : result.extreme ? "Extreme weather" : "No generated weather";
    if (phase === "pace") return result.pace ?? "";
    if (phase === "encounters") return `${result.count ?? 0} encounter(s)`;
    if (phase === "navigation") return result.outcome ?? "";
    if (phase === "discovery") return result.pursued ? "Discovery pursued" : "Passed by";
    if (phase === "pressOn") return result.pressedOn ? "Pressed on" : "Made camp";
    if (phase === "foraging") return result.resolution ? `${result.resolution.foodRequired ?? 0} food, ${result.resolution.waterRequired ?? 0} water` : "Resolved";
    if (phase === "camp") return `${result.watches?.length ?? 0} watches; ${result.sleep?.length ?? 0} sleep checks`;
    return "Resolved";
  }

  #notifyError(error) {
    console.error("morelord-journeys |", error);
    ui.notifications.error(error.issues?.join("; ") ?? error.message);
  }
}
