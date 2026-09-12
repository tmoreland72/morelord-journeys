import { renderPreservingScroll } from "../../../morelord-core/scripts/ui/scroll-preservation.js";
import { actorIdentity } from "../../../morelord-core/scripts/ui/actor-identity.js";
import { TRAVEL_PHASES } from "../domain/constants.mjs";
import { getDCConfiguration, readJourneySteps, isPhaseEnabled, nightEncountersEnabled, sleepAndShelterEnabled } from "../core/journey-settings.mjs";
import { addProgressModifier, beginTravelDay, completeTravelDay, readyJourney, recordPhase } from "../domain/engine.mjs";
import { createJourney } from "../domain/journey.mjs";
import { createRoute } from "../domain/route.mjs";
import { clearActiveJourney, getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { forcedMarchRollService } from "../services/forced-march-roll-service.mjs";
import { normalizeCampAssignments, validateCampAssignments } from "../domain/camp-watch-rules.mjs";
import { readCampAssignments } from "../ui/camp-assignment-controls.mjs";
import { phaseSkipReason } from "../domain/phase-rules.mjs";
import { displayJourneyRoll } from "../ui/journey-roll-display.mjs";
import { createDayCompletionPayload } from "../domain/travel-context.mjs";

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
const formatDistance = steps => {
  const numeric = Number(steps ?? 0);
  if (!numeric) return "0 days";
  const absolute = formatSteps(Math.abs(numeric));
  return `${numeric > 0 ? "+" : "-"}${absolute} ${Math.abs(numeric) === 3 ? "day" : "days"}`;
};

export class JourneyApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "morelord-journeys-dashboard",
      classes: ["ml-window", "ml-journeys-module"],
    position: { width: 720, height: "auto" },
    window: { title: "MORELORD_JOURNEYS.Name", icon: "fa-solid fa-compass" },
    actions: {
      openDocumentation: this.openDocumentation,
      createJourney: this.#createJourney,
      beginDay: this.#beginDay,
      advancePhase: this.#advancePhase,
      completeDay: this.#completeDay,
      endJourney: this.#endJourney,
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

  static openDocumentation() {
    const documentation = game.modules.get("morelord-core")?.api?.ui?.documentation;
    if (!documentation) return;
    documentation.register({
      id: "morelord-journeys", title: "Morelord Journeys", icon: "fa-solid fa-compass",
      subtitle: "Define a route and begin a stateful expedition.",
      sections: [
        { id: "planning", title: "Plan a Journey", icon: "fa-solid fa-route", introduction: "Choose the journey steps, name the expedition and route, set its origin and destination, and specify the route length in days and thirds. Set danger, discovery, resources, navigation, and traffic ratings before creating the journey." },
        { id: "travel", title: "Travel and Camp", icon: "fa-solid fa-person-hiking", introduction: "Follow the active journey's phases to resolve each travel day. Record travel progress and encounters, then arrange camp, watches, foraging, and rest using the enabled steps. Disabled steps are skipped and logged." },
        { id: "defaults", title: "Saved Defaults", icon: "fa-solid fa-bookmark", introduction: "Use Save as Default on the planner to remember your preferred setup for future journeys." }
      ]
    });
    return documentation.open("morelord-journeys");
  }

  render(options = {}) {
    const reset = this._resetScrollOnNextRender === true;
    this._resetScrollOnNextRender = false;
    return renderPreservingScroll(this, () => super.render(options), { reset });
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
        pending: (journey.currentDay?.pendingForcedMarchRolls ?? []).map(entry => ({ ...entry, identityHtml: actorIdentity({ ...journey.travelers.find(traveler => traveler.actorUuid === entry.actorUuid), ...entry }) })),
        results: (journey.currentDay?.forcedMarchResults ?? []).map(entry => ({ ...entry, identityHtml: actorIdentity({ ...journey.travelers.find(traveler => traveler.actorUuid === entry.actorUuid), ...entry }) }))
      },
      pressOnDC: getDCConfiguration().pressOn,
      recentLog: journey.log.slice(-12).reverse().map(entry => ({
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
        route, steps: readJourneySteps(this.element)
      }));
      await saveActiveJourney(journey);
      ui.notifications.info(game.i18n.localize("MORELORD_JOURNEYS.Notifications.Created"));
      this._resetScrollOnNextRender = true;
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
      this._resetScrollOnNextRender = true;
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
      if (phase === "pace") {
        source.currentDay.encounterCheck = null;
        result = { pace: value(this.element, "pace") || "normal" };
      }
      if (phase === "encounters") {
        const encounter = source.currentDay?.encounterCheck;
        const delaySteps = ["minor", "major"].includes(encounter?.outcome)
          ? integer(this.element, "encounterDelayDays", 0) * 3 + integer(this.element, "encounterDelayThirds", 0)
          : 0;
        result = { count: Number(encounter?.encounterCount ?? 0), delaySteps, encounter: encounter ?? null };
      }
      if (phase === "discovery") {
        const checkResult = source.currentDay?.roleRollResults?.discovery;
        const succeeded = checkResult?.outcome === "success";
        const costSteps = succeeded ? integer(this.element, "discoveryCostDays", 0) * 3 + integer(this.element, "discoveryCostThirds", 0) : 0;
        result = { pursued: costSteps > 0, costSteps, lead: source.currentDay?.discoveryLead ?? null, check: checkResult ?? null };
      }
      if (phase === "foraging") result = { resolution: source.currentDay?.foragingResolution ?? null };
      if (phase === "navigation") {
        const rolled = source.currentDay?.roleRollResults?.navigation;
        if (!rolled) throw new Error("Resolve the Navigation check before continuing.");
        const planned = Number(source.currentDay?.baseProgressSteps ?? 0)
          + (source.currentDay?.progressModifiers ?? []).reduce((total, modifier) => total + Number(modifier.steps ?? 0), 0);
        const distanceSteps = rolled.outcome === "lost" ? 0 : rolled.outcome === "reversed" ? -3 : rolled.outcome === "shortcut" ? planned + 1 : planned;
        result = { outcome: rolled.outcome, distanceSteps, roll: rolled };
      }
      if (phase === "pressOn") {
        const pressedOnControl = this.element.querySelector('[name="pressedOn"]');
        result = { pressedOn: pressedOnControl ? Boolean(pressedOnControl.checked) : source.currentDay?.pressedOn === true, saves: source.currentDay?.forcedMarchResults ?? [] };
        if (result.pressedOn && (source.currentDay?.pendingForcedMarchRolls?.length || result.saves.length < source.travelers.length)) {
          throw new Error(`Resolve every traveler's DC ${getDCConfiguration().pressOn} forced-march save before continuing.`);
        }
      }
      if (phase === "camp") {
        const assignments = this.element.querySelector("select[name^='watchAction']")
          ? readCampAssignments(this.element, source)
          : validateCampAssignments(normalizeCampAssignments(source.travelers, source.currentDay?.campWatches ?? []));
        if (nightEncountersEnabled(source) && !source.currentDay?.nightEncounterCheck) throw new Error("Resolve the night encounter check before continuing, or disable Night Encounters for this journey.");
        source.currentDay.campWatches = assignments;
        if (["minor", "nightAttack"].includes(source.currentDay?.nightEncounterCheck?.outcome)) {
          const interruptionHours = Math.max(0, Number(value(this.element, "nightInterruptionHours") || 0));
          source.currentDay.sleepInterruptions = source.travelers.map(traveler => ({
            actorUuid: traveler.actorUuid,
            actorName: traveler.name,
            watchIndex: source.currentDay.nightEncounterCheck.watchIndex,
            reason: source.currentDay.nightEncounterCheck.outcome === "nightAttack" ? "night attack" : "night encounter",
            suggestedHours: interruptionHours,
            hours: interruptionHours,
            recordedAt: Date.now()
          }));
        }
        result = { watches: assignments, nightEncounterSkipped: !nightEncountersEnabled(source) };
      }
      if (phase === "sleep") {
        if ((source.currentDay?.campSleepResults?.length ?? 0) < source.travelers.length) throw new Error("Resolve every traveler's sleep check before continuing.");
        if ((source.currentDay?.pendingPeacefulRestChoices?.length ?? 0) > 0) throw new Error("Wait for or resolve every pending Peaceful Rest choice before continuing.");
        result = { sleep: source.currentDay?.campSleepResults ?? [] };
      }

      let journey = recordPhase(source, phase, result);
      if (phase === "weather" && result.extreme) journey = addProgressModifier(journey, { id: "extreme-weather", label: "Extreme weather", steps: -1 });
      if (phase === "encounters" && result.delaySteps > 0) journey = addProgressModifier(journey, { id: "encounter-delay", label: "Encounter delay", steps: -result.delaySteps });
      if (phase === "discovery" && result.pursued) journey = addProgressModifier(journey, { id: "discovery-diversion", label: "Discovery diversion", steps: -Math.max(0, result.costSteps) });
      if (phase === "pressOn" && result.pressedOn) journey = addProgressModifier(journey, { id: "press-on", label: "Pressed on", steps: 1 });
      journey = JourneyApplication.#skipDisabledPhases(journey);
      await saveActiveJourney(journey);
      this._resetScrollOnNextRender = true;
      await this.render({ force: true });
    } catch (error) {
      this.#notifyError(error);
    }
  }

  static async #completeDay() {
    try {
      const source = await getActiveJourney();
      const completedDay = structuredClone(source.currentDay);
      const journey = completeTravelDay(source);
      completedDay.appliedProgressSteps = journey.progressSteps - source.progressSteps;
      await saveActiveJourney(journey);
      const locationApi = game.modules.get("morelord-core")?.api?.locations
        ?? globalThis.MorelordCore?.locations;
      const payload = createDayCompletionPayload(journey, completedDay, {
        locationResolver: id => locationApi?.get?.(id) ?? null
      });
      Hooks.callAll("morelordJourneys.dayComplete", payload);
      const key = journey.status === "arrived" ? "Arrived" : "DayComplete";
      ui.notifications.info(game.i18n.localize(`MORELORD_JOURNEYS.Notifications.${key}`));
      this._resetScrollOnNextRender = true;
      await this.render({ force: true });
    } catch (error) {
      this.#notifyError(error);
    }
  }

  static async #endJourney(event) {
    event?.preventDefault();
    const journey = await getActiveJourney();
    if (journey?.status !== "arrived") return this.#notifyError(new Error("Only an arrived expedition can be ended."));
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "End Journey" },
      content: `<p>End <strong>${foundry.utils.escapeHTML(journey.name)}</strong> and return to the journey planner?</p><p>The completed journey will no longer be shown as the active expedition.</p>`
    });
    if (!confirmed) return;
    await clearActiveJourney();
    this._resetScrollOnNextRender = true;
    await this.render({ force: true });
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
      await displayJourneyRoll(roll, { flavor: "Morelord Journeys extreme-weather check", rollMode: "gmroll" });
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
            { label: "Ice storm", detail: "Severe ice and falling debris.", cold: true },
            { label: "Extreme cold", detail: "Bitter cold makes exposure dangerous.", cold: true },
            { label: "Avalanche conditions", detail: "Unstable snow threatens steep terrain.", cold: true },
            { label: "Freezing fog", detail: "Ice-laden fog sharply limits visibility.", cold: true },
            { label: "Whiteout", detail: "Snow and wind erase landmarks and the horizon.", cold: true }
          ]
        : [
            { label: "Thunderstorm", detail: "Lightning and heavy rain cross the route.", cold: false },
            { label: "Flash flooding", detail: "Sudden water makes the route hazardous.", cold: false },
            { label: "Heat wave", detail: "Dangerous heat settles over the route.", cold: false },
            { label: "Tornado", detail: "Rotating winds threaten the route and nearby shelter.", cold: false },
            { label: "Wildfire smoke", detail: "Dense smoke reduces visibility and air quality.", cold: false },
            { label: "Dust storm", detail: "Blowing dust obscures the route and exposed travelers.", cold: false }
          ];
      const ordinary = season === "cold"
        ? [
            { label: "Cold and clear", detail: "Clear skies accompany biting cold.", cold: true },
            { label: "Snow flurries", detail: "Light snow falls intermittently.", cold: true },
            { label: "Freezing drizzle", detail: "Light ice accumulates on exposed surfaces.", cold: true },
            { label: "Overcast", detail: "Low clouds mute the winter light.", cold: true },
            { label: "Strong cold winds", detail: "Cold gusts cross the route.", cold: true },
            { label: "Sleet", detail: "Mixed frozen precipitation makes travel unpleasant.", cold: true }
          ]
        : [
            { label: "Fair weather", detail: "Clear, comfortable traveling conditions.", cold: false },
            { label: "Rain showers", detail: "Brief rain passes across the route.", cold: false },
            { label: "Humid haze", detail: "Warm haze softens distant landmarks.", cold: false },
            { label: "Overcast", detail: "Cloud cover accompanies ordinary travel.", cold: false },
            { label: "Strong warm winds", detail: "Warm gusts cross the route.", cold: false },
            { label: "Clear and hot", detail: "Bright sun raises the daytime temperature.", cold: false }
          ];
      const table = forcedExtreme ? extreme : ordinary;
      const roll = await new Roll(`1d${table.length}`).evaluate();
      const weather = table[Number(roll.total) - 1];
      journey.currentDay.generatedWeather = { ...weather, extreme: forcedExtreme, season, roll: Number(roll.total), rolledAt: Date.now() };
      await saveActiveJourney(journey);
      await displayJourneyRoll(roll, { flavor: `Morelord Journeys weather forecast — ${weather.label}`, rollMode: "gmroll" });
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
      await displayJourneyRoll(roll, { flavor: `Morelord Journeys discovery lead — ${category}`, rollMode: "gmroll" });
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async #showDiscoveryOutcomes(event) {
    event.preventDefault();
    const rows = ["01–10 Tracks or trail", "11–20 Distant sight", "21–30 Sound", "31–40 Remains or abandoned gear", "41–50 Natural feature", "51–60 Ruin or structure", "61–70 Creature activity", "71–80 Social sign", "81–90 Hazard warning", "91–100 Magical anomaly"];
    await foundry.applications.api.DialogV2.prompt({ window: { title: "Discovery d100 Outcomes", icon: "fa-solid fa-circle-question" }, content: `<div class="ml-journeys-help-content"><section><h3>Use</h3><ul><li>Roll or choose a category.</li><li>Present a clue, not the full discovery.</li><li>A failed Observer check costs no time.</li></ul></section><section><h3>d100 Results</h3><ul>${rows.map(row => `<li>${row}</li>`).join("")}</ul></section></div>`, ok: { label: "Close" } });
  }

  static async #showEncounterOutcomes(event) {
    event.preventDefault();
    await foundry.applications.api.DialogV2.prompt({ window: { title: "Day Encounter Outcomes", icon: "fa-solid fa-circle-question" }, content: `<div class="ml-journeys-help-content"><section><h3>d100 Results</h3><ul><li><strong>1–40:</strong> No encounter</li><li><strong>41–60:</strong> Signs or foreshadowing</li><li><strong>61–85:</strong> Minor encounter</li><li><strong>86+:</strong> Major encounter</li></ul></section><section><h3>Examples</h3><ul><li>Minor: hazard, traveler, ruin, animal, or faction scene.</li><li>Major: deadly hazard, discovery, confrontation, chase, siege, or combat.</li><li>Minor and Major measure importance—not combat.</li></ul></section></div>`, ok: { label: "Close" } });
  }

  static async #showNightEncounterOutcomes(event) {
    event.preventDefault();
    await foundry.applications.api.DialogV2.prompt({ window: { title: "Night Encounter Outcomes", icon: "fa-solid fa-circle-question" }, content: `<div class="ml-journeys-help-content"><section><h3>d100 Results</h3><ul><li><strong>1–30:</strong> Peaceful Rest</li><li><strong>31–60:</strong> Uneventful</li><li><strong>61–85:</strong> Minor encounter</li><li><strong>86+:</strong> Night Attack</li></ul></section><section><h3>Modifiers</h3><ul><li>Danger</li><li>Weather</li><li>Camp quality</li><li>Fire visibility</li></ul></section></div>`, ok: { label: "Close" } });
  }

  static async #requestForcedMarchRolls(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      journey.currentDay.pressedOn = true;
      await saveActiveJourney(journey);
      await forcedMarchRollService.requestParty();
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static #formatLogResult(entry) {
    if (entry.type === "dayCompleted") return `${formatSteps(entry.data.applied ?? 0)} day(s) applied; ${formatSteps(entry.data.total ?? 0)} traveled`;
    if (entry.type === "progressModifierAdded") return `${entry.data.label}: ${formatDistance(entry.data.steps)}`;
    if (entry.type !== "phaseRecorded") return "";
    const result = entry.data?.result ?? {};
    const phase = entry.data?.phase;
    if (phase === "weather") return result.generated ? `${result.generated.label}${result.extreme ? " (extreme)" : ""}` : result.extreme ? "Extreme weather" : "No generated weather";
    if (phase === "pace") return result.pace ?? "";
    if (phase === "encounters") return `${result.count ?? 0} encounter(s)`;
    if (phase === "navigation") {
      return `${result.outcome ?? "Resolved"} — ${formatDistance(result.distanceSteps ?? 0)}`;
    }
    if (phase === "discovery") return result.pursued ? "Discovery pursued" : "Passed by";
    if (phase === "pressOn") return result.pressedOn ? `Pressed on — ${formatDistance(1)}` : "Did not press on — 0 days";
    if (phase === "foraging") {
      if (!result.resolution) return "Resolved";
      const added = (result.resolution.excessRationsAdded ?? []).reduce((total, entry) => total + Number(entry.quantity ?? 0), 0);
      return `+${added} food added; ${result.resolution.foodRequired ?? 0} ration(s) and ${result.resolution.waterRequired ?? 0} water pint(s) still required`;
    }
    if (phase === "camp") return `${result.watches?.length ?? 0} watches; ${result.sleep?.length ?? 0} sleep checks`;
    if (phase === "sleep") return `${result.sleep?.length ?? 0} sleep checks`;
    return "Resolved";
  }

  static #skipDisabledPhases(source) {
    let journey = source;
    const skipReason = () => phaseSkipReason({ phase: journey.phase, pace: journey.currentDay?.pace, enabled: isPhaseEnabled(journey.phase, journey) });
    while (journey.phase && journey.phase !== "dayComplete" && skipReason()) {
      const phase = journey.phase;
      const result = { skipped: true, reason: skipReason() };
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
