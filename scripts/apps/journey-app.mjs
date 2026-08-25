import { TRAVEL_PHASES } from "../domain/constants.mjs";
import { isPhaseEnabled, nightEncountersEnabled, sleepAndShelterEnabled } from "../core/journey-settings.mjs";
import { addProgressModifier, beginTravelDay, completeTravelDay, readyJourney, recordPhase } from "../domain/engine.mjs";
import { createJourney } from "../domain/journey.mjs";
import { createRoute } from "../domain/route.mjs";
import { clearActiveJourney, getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { forcedMarchRollService } from "../services/forced-march-roll-service.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const value = (element, name) => element.querySelector(`[name="${name}"]`)?.value ?? "";
const checked = (element, name) => element.querySelector(`[name="${name}"]`)?.checked ?? false;
const integer = (element, name, fallback = 0) => {
  const parsed = Number.parseInt(value(element, name), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};
const formatSteps = steps => {
  const value = Number(steps ?? 0);
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const days = Math.floor(absolute / 3);
  const remainder = absolute % 3;
  if (!remainder) return `${sign}${days}`;
  return `${sign}${days ? days : ""}${remainder === 1 ? "⅓" : "⅔"}`;
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
      rollExtremeWeather: this.#rollExtremeWeather,
      rollWeatherForecast: this.#rollWeatherForecast,
      rollDiscoveryLead: this.#rollDiscoveryLead,
      showDiscoveryOutcomes: this.#showDiscoveryOutcomes,
      showEncounterOutcomes: this.#showEncounterOutcomes,
      showNightEncounterOutcomes: this.#showNightEncounterOutcomes,
      requestForcedMarchRolls: this.#requestForcedMarchRolls
    }
  };

  static PARTS = {
    content: { template: "modules/morelord-journeys/templates/journey-app.hbs" }
  };

  render(options = {}) {
    const scroller = this.element?.querySelector?.(".ml-journeys.app-shell");
    const scrollPosition = scroller ? { top: scroller.scrollTop, left: scroller.scrollLeft } : null;
    return Promise.resolve(super.render(options)).then(result => {
      if (scrollPosition) {
        const replacement = this.element?.querySelector?.(".ml-journeys.app-shell");
        replacement?.scrollTo({ top: scrollPosition.top, left: scrollPosition.left, behavior: "auto" });
      }
      return result;
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const journey = await getActiveJourney();
    if (!journey) return { ...context, hasJourney: false };
    const length = Math.max(journey.routeSnapshot.lengthSteps, journey.routeSnapshot.lengthSteps - journey.remainingSteps);
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
        daysCurrent: formatSteps(journey.progressSteps),
        daysTotal: formatSteps(length),
        daysRemaining: formatSteps(journey.remainingSteps),
        originalDaysTotal: formatSteps(journey.routeSnapshot.lengthSteps),
        extended: journey.remainingSteps > Math.max(0, journey.routeSnapshot.lengthSteps - journey.progressSteps)
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
      extremeWeatherCheck: journey.currentDay?.extremeWeatherCheck ?? null,
      discoveryLead: journey.currentDay?.discoveryLead ?? null,
      discoveryCheckSucceeded: journey.currentDay?.roleRollResults?.discovery?.outcome === "success",
      forcedMarch: {
        pending: journey.currentDay?.pendingForcedMarchRolls ?? [],
        results: journey.currentDay?.forcedMarchResults ?? []
      },
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
        lengthSteps: integer(this.element, "lengthDays", 1) * 3 + integer(this.element, "lengthThirds", 0),
        danger: integer(this.element, "danger", 1),
        discoveryDC: integer(this.element, "discoveryDC", 15),
        resourcesDC: integer(this.element, "resourcesDC", 15),
        navigationDC: integer(this.element, "navigationDC", 10),
        traffic: value(this.element, "routeTraffic") || "ordinary"
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
      let journey = beginTravelDay(await getActiveJourney());
      journey = JourneyApplication.#skipDisabledPhases(journey);
      await saveActiveJourney(journey);
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
      if (phase === "weather") {
        if (!source.currentDay?.extremeWeatherCheck) throw new Error("Roll the extreme-weather check before continuing.");
        if (!source.currentDay?.generatedWeather) throw new Error("Roll the weather forecast before continuing.");
        result = {
        extreme: checked(this.element, "extremeWeather"),
        cold: Boolean(source.currentDay?.generatedWeather?.cold),
        generated: source.currentDay?.generatedWeather ?? null
        };
      }
      if (phase === "pace") result = { pace: value(this.element, "pace") || "normal" };
      if (phase === "encounters") result = { count: Number(source.currentDay?.encounterCheck?.encounterCount ?? 0) };
      if (phase === "discovery") {
        const checkResult = source.currentDay?.roleRollResults?.discovery;
        const succeeded = checkResult?.outcome === "success";
        const costSteps = succeeded ? integer(this.element, "discoveryCostDays", 0) * 3 + integer(this.element, "discoveryCostThirds", 0) : 0;
        result = { pursued: costSteps > 0, costSteps, lead: source.currentDay?.discoveryLead ?? null, check: checkResult ?? null };
      }
      if (phase === "foraging") result = { resolution: source.currentDay?.foragingResolution ?? null };
      if (phase === "navigation") {
        const rolled = source.currentDay?.roleRollResults?.navigation;
        result = { outcome: rolled?.outcome ?? (value(this.element, "navigationOutcome") || "success"), roll: rolled ?? null };
      }
      if (phase === "pressOn") {
        result = { pressedOn: checked(this.element, "pressedOn"), saves: source.currentDay?.forcedMarchResults ?? [] };
        if (result.pressedOn && (source.currentDay?.pendingForcedMarchRolls?.length || result.saves.length < source.travelers.length)) {
          throw new Error("Resolve every traveler's DC 12 forced-march save before continuing.");
        }
      }
      if (phase === "camp") {
        if (nightEncountersEnabled() && !source.currentDay?.nightEncounterCheck) throw new Error("Resolve the night encounter check before continuing, or disable Night Encounters in Journeys Settings.");
        result = { watches: source.currentDay?.campWatches ?? [], nightEncounterSkipped: !nightEncountersEnabled() };
      }
      if (phase === "sleep") {
        if ((source.currentDay?.campSleepResults?.length ?? 0) < source.travelers.length) throw new Error("Resolve every traveler's sleep check before continuing.");
        if ((source.currentDay?.pendingPeacefulRestChoices?.length ?? 0) > 0) throw new Error("Wait for or resolve every pending Peaceful Rest choice before continuing.");
        result = { sleep: source.currentDay?.campSleepResults ?? [] };
      }

      let journey = recordPhase(source, phase, result);
      if (phase === "weather" && result.extreme) journey = addProgressModifier(journey, { id: "extreme-weather", label: "Extreme weather", steps: -1 });
      if (phase === "discovery" && result.pursued) journey = addProgressModifier(journey, { id: "discovery-diversion", label: "Discovery diversion", steps: -Math.max(0, result.costSteps) });
      if (phase === "pressOn" && result.pressedOn) journey = addProgressModifier(journey, { id: "press-on", label: "Pressed on", steps: 1 });
      journey = JourneyApplication.#skipDisabledPhases(journey);
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

  static async #rollExtremeWeather(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      const roll = await new Roll("1d20").evaluate();
      const total = Number(roll.total);
      journey.currentDay.extremeWeatherCheck = { roll: total, extreme: total === 1, rolledAt: Date.now() };
      journey.currentDay.generatedWeather = null;
      await saveActiveJourney(journey);
      await this.render({ force: true });
    } catch (error) {
      console.error("morelord-journeys | Weather generation failed", error);
      ui.notifications.error(error.issues?.join("; ") ?? error.message);
    }
  }

  static async #rollWeatherForecast(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      if (!journey.currentDay?.extremeWeatherCheck && !checked(this.element, "extremeWeather")) throw new Error("Roll the extreme-weather check before rolling the forecast.");
      const forcedExtreme = checked(this.element, "extremeWeather") || Boolean(journey.currentDay?.extremeWeatherCheck?.extreme);
      const season = value(this.element, "weatherSeason") || "warm";
      const extreme = season === "cold"
        ? [
            { label: "Blizzard", detail: "Heavy snow and dangerous wind.", cold: true },
            { label: "Freezing rain", detail: "Ice coats exposed surfaces.", cold: true },
            { label: "Ice storm", detail: "Severe ice and falling debris.", cold: true },
            { label: "Cold snap", detail: "Bitter and dangerous cold.", cold: true }
          ]
        : [
            { label: "Gale-force winds", detail: "Violent winds impede travel.", cold: false },
            { label: "Thunderstorm", detail: "Lightning and heavy rain cross the route.", cold: false },
            { label: "Flash flooding", detail: "Sudden water makes the route hazardous.", cold: false },
            { label: "Heat wave", detail: "Dangerous heat settles over the route.", cold: false }
          ];
      const ordinary = [
        { label: "Cold and clear", detail: "Clear conditions with biting cold.", cold: true },
        { label: "Rain or snow", detail: "Wet weather reduces visibility.", cold: season === "cold" },
        { label: "Overcast", detail: "Cloud cover with ordinary travel.", cold: false },
        { label: "Fair weather", detail: "Clear, comfortable traveling conditions.", cold: false },
        { label: "Strong winds", detail: "Gusting winds cross the route.", cold: false },
        { label: "Light precipitation", detail: "Intermittent rain or snow.", cold: season === "cold" }
      ];
      const table = forcedExtreme ? extreme : ordinary;
      const roll = await new Roll(`1d${table.length}`).evaluate();
      const weather = table[Number(roll.total) - 1];
      journey.currentDay.generatedWeather = { ...weather, extreme: forcedExtreme, season, roll: Number(roll.total), rolledAt: Date.now() };
      await saveActiveJourney(journey);
      await this.render({ force: true });
    } catch (error) {
      console.error("morelord-journeys | Weather forecast failed", error);
      ui.notifications.error(error.message);
    }
  }

  static async #rollDiscoveryLead(event) {
    event.preventDefault();
    const categories = [
      [10, "Tracks or trail", "Fresh tracks leave the route toward high ground."],
      [20, "Distant sight", "Smoke, light, or movement is visible beyond the route."],
      [30, "Sound", "An unexplained sound carries from an unseen location."],
      [40, "Remains", "Broken equipment, blood, or remains mark a side trail."],
      [50, "Natural feature", "An unusual spring, cave, grove, or formation lies nearby."],
      [60, "Ruin or structure", "Worked stone or a ruined structure is partly concealed."],
      [70, "Creature activity", "Animals gather, flee, or circle a nearby location."],
      [80, "Social sign", "A camp, banner, message, shrine, or trade marker is found."],
      [90, "Hazard warning", "Signs warn of a flood, collapse, fire, or predator."],
      [100, "Magical anomaly", "Light, plants, weather, or tracks behave impossibly."]
    ];
    try {
      const journey = await getActiveJourney();
      const roll = await new Roll("1d100").evaluate();
      const total = Number(roll.total);
      const [maximum, category, example] = categories.find(([limit]) => total <= limit);
      journey.currentDay.discoveryLead = { roll: total, maximum, category, example, rolledAt: Date.now() };
      await saveActiveJourney(journey);
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #showDiscoveryOutcomes(event) {
    event.preventDefault();
    const rows = ["01–10 Tracks or trail", "11–20 Distant sight", "21–30 Sound", "31–40 Remains or abandoned gear", "41–50 Natural feature", "51–60 Ruin or structure", "61–70 Creature activity", "71–80 Social sign", "81–90 Hazard warning", "91–100 Magical anomaly"];
    await foundry.applications.api.DialogV2.prompt({ window: { title: "Discovery d100 Outcomes", icon: "fa-solid fa-circle-question" }, content: `<div class="ml-journeys-help-content"><p>Use the roll or manually choose any category. Present a clue rather than revealing the discovery.</p><ul>${rows.map(row => `<li>${row}</li>`).join("")}</ul><p>A failed Observer check always means no lead is pursued and no time is lost.</p></div>`, ok: { label: "Close" } });
  }

  static async #showEncounterOutcomes(event) {
    event.preventDefault();
    await foundry.applications.api.DialogV2.prompt({ window: { title: "Day Encounter Outcomes", icon: "fa-solid fa-circle-question" }, content: `<div class="ml-journeys-help-content"><ul><li><strong>1–40 No encounter:</strong> travel remains quiet.</li><li><strong>41–60 Signs:</strong> tracks, smoke, abandoned gear, distant sounds, or other foreshadowing.</li><li><strong>61–85 Minor:</strong> a damaged bridge, roadside traveler, environmental hazard, useful ruin, animal threat, or brief faction scene.</li><li><strong>86+ Major:</strong> a deadly hazard, important discovery, faction confrontation, major social scene, chase, siege, or combat.</li></ul><p>Minor and Major describe narrative importance, not whether fighting occurs. Danger and the automatically determined route, pace, and weather modifiers alter the d100 total.</p></div>`, ok: { label: "Close" } });
  }

  static async #showNightEncounterOutcomes(event) {
    event.preventDefault();
    await foundry.applications.api.DialogV2.prompt({ window: { title: "Night Encounter Outcomes", icon: "fa-solid fa-circle-question" }, content: `<div class="ml-journeys-help-content"><ul><li><strong>1–30 Peaceful Rest:</strong> eligible characters choose a recorded rest benefit.</li><li><strong>31–60 Uneventful:</strong> the camp is undisturbed.</li><li><strong>61–85 Minor:</strong> a hazard, discovery, or social scene interrupts one watch.</li><li><strong>86+ Night Attack:</strong> danger interrupts one randomly selected watch.</li></ul><p>Danger, weather, and derived camp quality modify the roll. A fire is excellent setup but also advertises the camp.</p></div>`, ok: { label: "Close" } });
  }

  static async #requestForcedMarchRolls(event) {
    event.preventDefault();
    try {
      await forcedMarchRollService.requestParty();
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static #formatLogResult(entry) {
    if (entry.type === "dayCompleted") return `${formatSteps(entry.data.applied ?? 0)} day(s) applied; ${formatSteps(entry.data.total ?? 0)} traveled`;
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
    if (phase === "sleep") return `${result.sleep?.length ?? 0} sleep checks`;
    return "Resolved";
  }

  static #skipDisabledPhases(source) {
    let journey = source;
    while (journey.phase && journey.phase !== "dayComplete" && !isPhaseEnabled(journey.phase)) {
      const phase = journey.phase;
      const result = { skipped: true, reason: "Disabled by world setting" };
      if (phase === "pace") result.pace = "normal";
      if (phase === "navigation") result.outcome = "success";
      journey = recordPhase(journey, phase, result);
    }
    return journey;
  }

  #notifyError(error) {
    console.error("morelord-journeys |", error);
    ui.notifications.error(error.issues?.join("; ") ?? error.message);
  }
}
