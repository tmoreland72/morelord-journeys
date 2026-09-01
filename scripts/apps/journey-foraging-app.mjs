import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { foragingRollService } from "../services/foraging-roll-service.mjs";
import { SupplyConsumptionService } from "../services/supply-consumption-service.mjs";
import { SupplyManifestService } from "../services/supply-manifest-service.mjs";
import { supplyConsequenceService } from "../services/supply-consequence-service.mjs";
import { CampSupplyService } from "../services/camp-supply-service.mjs";
import { campPerceptionRollService } from "../services/camp-perception-roll-service.mjs";
import { peacefulRestService } from "../services/peaceful-rest-service.mjs";
import { getDCConfiguration, sleepAndShelterEnabled } from "../core/journey-settings.mjs";
import { forcedMarchRollService } from "../services/forced-march-roll-service.mjs";
import { sleepRollService } from "../services/sleep-roll-service.mjs";
import { adjustActorExhaustion } from "../services/actor-exhaustion-service.mjs";
import { JourneyFinalApplication as BaseJourneyApplication } from "./journey-final-app.mjs";
import { createOutcomeDetails } from "../ui/outcome-details.mjs";
import { readCampAssignments } from "../ui/camp-assignment-controls.mjs";
import { longRestFailureReasons } from "../domain/sleep-rules.mjs";
import { availableCampSleepHours } from "../domain/camp-watch-rules.mjs";
import { updateJourneyTravelContext } from "../domain/travel-context.mjs";

const CAMP_ACTION_HELP = Object.freeze({
  "Take a Watch": "Remain alert during this watch and make any required Perception checks normally.",
  Craft: "Make 2 hours of crafting progress. Requires the related tools and usually a campfire; Perception checks are at disadvantage.",
  Cook: "Requires a campfire. On a successful verbal resolution, remove one Exhaustion from up to two characters. Perception checks are at disadvantage.",
  Prepare: "Prepare one ability and gain a d6 Preparation die that decreases after each use until depleted.",
  Slumber: "Sleep instead of watching. Automatically fail Perception checks and qualify for Peaceful Rest choices when enough sleep is completed.",
  Task: "Replace the Camp Action with 2 hours of progress on another suitable task; Perception checks are usually at disadvantage."
});
const SLEEP_MODIFIER_LABELS = Object.freeze({ tent: "Tent", bedroll: "Bedroll", blanket: "Blanket in cold weather", extremeWeather: "Extreme weather", peacefulNight: "Peaceful night" });
const supplyConsumption = new SupplyConsumptionService();
const supplyManifest = new SupplyManifestService();
const campSupplies = new CampSupplyService();

function readTravelContextForm(app) {
  const locationId = String(app.element.querySelector("[name='travelLocationId']")?.value ?? "") || null;
  const activityHours = Math.max(0, Math.min(24, Number(app.element.querySelector("[name='travelActivityHours']")?.value ?? 2)));
  const rows = Array.from(app.element.querySelectorAll("[data-temporary-capability-row]"));
  const temporaryCapabilities = rows.map(row => ({
    type: String(row.querySelector("[data-capability-type]")?.value ?? "").trim(),
    tier: String(row.querySelector("[data-capability-tier]")?.value ?? "common").trim(),
    specialty: String(row.querySelector("[data-capability-specialty]")?.value ?? "").trim() || null,
    source: "journey"
  })).filter(capability => capability.type);
  return { locationId, activityHours, temporaryCapabilities };
}

function selectedShelter(row) {
  const selected = new Set(String(row?.querySelector("[data-shelter-select]")?.value ?? "").split("+").filter(Boolean));
  return Object.fromEntries(["tent", "bedroll", "blanket"].map(gear => [gear, selected.has(gear)]));
}
function shelterOptions(owned) {
  const available = ["tent", "bedroll", "blanket"].filter(gear => owned[gear]);
  const labels = { tent: "Tent", bedroll: "Bedroll", blanket: "Blanket" };
  const combinations = [];
  for (let mask = 1; mask < 2 ** available.length; mask += 1) {
    const gears = available.filter((_, index) => mask & (1 << index));
    combinations.push({ value: gears.join("+"), label: gears.map(gear => labels[gear]).join(" + ") });
  }
  return [{ value: "", label: available.length ? "No shelter" : "No shelter items owned" }, ...combinations];
}

function describeInterruptionSources(result, currentDay) {
  const sources = (result.interruptionSources?.length ? result.interruptionSources : (currentDay?.sleepInterruptions ?? [])
    .filter(item => item.actorUuid === result.actorUuid)
    .map(item => ({ reason: item.reason ?? "recorded interruption", hours: Number(item.hours ?? Number(item.minutes ?? 0) / 60), watchIndex: Number.isInteger(Number(item.watchIndex)) ? Number(item.watchIndex) : null })));
  const describedHours = sources.reduce((total, source) => total + Number(source.hours ?? 0), 0);
  const interruptedHours = Number(result.interruptionHours ?? Number(result.interruptionMinutes ?? 0) / 60);
  const complete = [...sources];
  if (interruptedHours > describedHours) complete.push({ reason: "GM-entered adjustment", hours: interruptedHours - describedHours, watchIndex: null });
  if (!complete.length) return interruptedHours > 0 ? "Source was not recorded by an earlier Journeys version" : "No interruption";
  return complete.map(source => `${source.reason === "combat" ? "Combat encounter" : source.reason}${Number.isInteger(source.watchIndex) ? ` during Watch ${source.watchIndex + 1}` : ""}: ${source.hours} hour(s)`).join("; ");
}

export class JourneyForagingApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = { actions: {
    manageLocations: this.manageLocations,
    saveTravelContext: this.saveTravelContext,
    addTemporaryCapability: this.addTemporaryCapability,
    removeTemporaryCapability: this.removeTemporaryCapability,
    requestForagingRolls: this.requestForagingRolls,
    autoForagingSuccess: this.autoForagingSuccess,
    autoForagingFailure: this.autoForagingFailure,
    resendForagingRoll: this.resendForagingRoll,
    consumeTravelSupplies: this.consumeTravelSupplies,
    resolveTravelSuppliesManually: this.resolveTravelSuppliesManually,
    autoSupplySaveSuccess: this.autoSupplySaveSuccess,
    autoSupplySaveFailure: this.autoSupplySaveFailure,
    saveCampSleepPlan: this.saveCampSleepPlan,
    rollCampSleep: this.rollCampSleep,
    resendSleepRoll: this.resendSleepRoll,
    autoSleepSuccess: this.autoSleepSuccess,
    autoSleepFailure: this.autoSleepFailure,
    resendPeacefulRest: this.resendPeacefulRest,
    setPeacefulRest: this.setPeacefulRest,
    resolveCookSuccess: this.resolveCookSuccess,
    resendForcedMarch: this.resendForcedMarch,
    autoForcedMarchSuccess: this.autoForcedMarchSuccess,
    autoForcedMarchFailure: this.autoForcedMarchFailure,
    setWaterState: this.setWaterState
  } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const locationApi = game.modules.get("morelord-core")?.api?.locations
      ?? globalThis.MorelordCore?.locations;
    const currentLocationId = context.journey?.currentDay?.locationId
      ?? context.journey?.currentLocationId
      ?? "";
    const temporaryCapabilities = context.journey?.currentDay?.temporaryCapabilities
      ?? context.journey?.temporaryCapabilities
      ?? [];
    return {
      ...context,
      canManageLocations: game.user.isGM,
      travelLocations: [
        { id: "", name: "On the Road", selected: !currentLocationId },
        ...(locationApi?.list?.() ?? []).map(location => ({
          id: location.id,
          name: location.name,
          selected: location.id === currentLocationId
        }))
      ],
      travelActivityHours: context.journey?.currentDay?.activityHours
        ?? context.journey?.activityHoursPerDay
        ?? 2,
      temporaryCapabilities: temporaryCapabilities.map((capability, index) => ({
        ...capability,
        index,
        typeOptions: (locationApi?.listCapabilities?.() ?? []).map(type => ({
          id: type.id,
          name: type.name,
          selected: type.id === capability.type
        })),
        tierOptions: (locationApi?.capabilityTiers ?? []).map(tier => ({
          id: tier,
          name: tier === "veryRare" ? "Very Rare" : tier.charAt(0).toUpperCase() + tier.slice(1),
          selected: tier === capability.tier
        }))
      })),
      hasTemporaryCapabilities: temporaryCapabilities.length > 0
    };
  }

  static async saveTravelContext(event) {
    event.preventDefault();
    if (!game.user.isGM) return;
    try {
      const existing = await getActiveJourney();
      if (!existing) return;
      const { locationId, activityHours, temporaryCapabilities } = readTravelContextForm(this);
      const journey = updateJourneyTravelContext(existing, { locationId, activityHours, temporaryCapabilities });
      await saveActiveJourney(journey);
      Hooks.callAll("morelordJourneys.contextChanged", { locationId, activityHours, temporaryCapabilities });
      ui.notifications.info("Journey travel context saved.");
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(`Could not save travel context: ${error.message}`);
    }
  }

  static async addTemporaryCapability(event) {
    event.preventDefault();
    const existing = await getActiveJourney();
    if (!existing || !game.user.isGM) return;
    const context = readTravelContextForm(this);
    const locationApi = game.modules.get("morelord-core")?.api?.locations
      ?? globalThis.MorelordCore?.locations;
    context.temporaryCapabilities.push({
      type: locationApi?.listCapabilities?.()[0]?.id ?? "marketplace",
      tier: "common",
      specialty: null,
      source: "journey"
    });
    await saveActiveJourney(updateJourneyTravelContext(existing, context));
    await this.render({ force: true });
  }

  static async removeTemporaryCapability(event, target) {
    event.preventDefault();
    const existing = await getActiveJourney();
    if (!existing || !game.user.isGM) return;
    const context = readTravelContextForm(this);
    context.temporaryCapabilities.splice(Number(target.dataset.index), 1);
    await saveActiveJourney(updateJourneyTravelContext(existing, context));
    await this.render({ force: true });
  }

  static manageLocations(event) {
    event.preventDefault();
    const locations = game.modules.get("morelord-core")?.api?.locations
      ?? globalThis.MorelordCore?.locations;
    if (typeof locations?.open !== "function") {
      ui.notifications.warn("Morelord Locations is unavailable. Update and enable Morelord Core.");
      return;
    }
    return locations.open();
  }

  #foragingUpdated = () => { if (this.rendered) void this.render({ force: true }); };
  #supplyUpdated = () => { if (this.rendered) void this.render({ force: true }); };
  #campPerceptionUpdated = () => { if (this.rendered) void this.render({ force: true }); };
  #peacefulRestUpdated = () => { if (this.rendered) void this.render({ force: true }); };
  #forcedMarchUpdated = () => { if (this.rendered) void this.render({ force: true }); };
  #sleepUpdated = () => { if (this.rendered) void this.render({ force: true }); };
  #sleepWindowExpanded = false;

  constructor(options = {}) {
    super(options);
    foragingRollService.addEventListener("updated", this.#foragingUpdated);
    supplyConsequenceService.addEventListener("updated", this.#supplyUpdated);
    campPerceptionRollService.addEventListener("updated", this.#campPerceptionUpdated);
    peacefulRestService.addEventListener("updated", this.#peacefulRestUpdated);
    forcedMarchRollService.addEventListener("updated", this.#forcedMarchUpdated);
    sleepRollService.addEventListener("updated", this.#sleepUpdated);
  }

  async close(options = {}) {
    foragingRollService.removeEventListener("updated", this.#foragingUpdated);
    supplyConsequenceService.removeEventListener("updated", this.#supplyUpdated);
    campPerceptionRollService.removeEventListener("updated", this.#campPerceptionUpdated);
    peacefulRestService.removeEventListener("updated", this.#peacefulRestUpdated);
    forcedMarchRollService.removeEventListener("updated", this.#forcedMarchUpdated);
    sleepRollService.removeEventListener("updated", this.#sleepUpdated);
    return super.close(options);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (context.phaseIs?.foraging) this.#renderForaging(context);
    if (context.phaseIs?.camp) {
      this.#enhanceCampActions();
    }
    if (context.phaseIs?.sleep) {
      this.#expandForSleepPhase();
      this.#renderCampSleep(context);
    }
    if (context.phaseIs?.pressOn) this.#configurePressOn();
  }

  #expandForSleepPhase() {
    if (this.#sleepWindowExpanded) return;
    this.#sleepWindowExpanded = true;
    const margin = 48;
    const width = Math.min(1180, Math.max(720, window.innerWidth - margin * 2));
    const height = Math.min(880, Math.max(640, window.innerHeight - margin * 2));
    const current = this.element.getBoundingClientRect();
    if (current.width >= width && current.height >= height) return;
    const position = {
      width: Math.max(current.width, width),
      height: Math.max(current.height, height),
      left: Math.max(margin, Math.round((window.innerWidth - Math.max(current.width, width)) / 2)),
      top: Math.max(margin, Math.round((window.innerHeight - Math.max(current.height, height)) / 2))
    };
    if (typeof this.setPosition === "function") this.setPosition(position);
    else {
      Object.assign(this.element.style, Object.fromEntries(Object.entries(position).map(([key, value]) => [key, `${value}px`])));
    }
  }

  #configurePressOn() {
    const checkbox = this.element.querySelector("[name='pressedOn']");
    const button = this.element.querySelector("[data-action='requestForcedMarchRolls']");
    if (!checkbox || !button) return;
    const sync = () => { button.hidden = !checkbox.checked; };
    checkbox.addEventListener("change", async () => {
      sync();
      const journey = await getActiveJourney();
      journey.currentDay.pressedOn = checkbox.checked;
      await saveActiveJourney(journey);
    });
    sync();
  }
  #enhanceCampActions() {
    const panel = this.element.querySelector(".journey-camp-planner");
    panel?.addEventListener("change", async event => {
      if (!event.target.matches("select[name^='watchAction'], select[name^='watchPeriod'], select[name^='additionalWatchPeriod'], [name='campfire']")) return;
      const journey = await getActiveJourney();
      try { journey.currentDay.campWatches = readCampAssignments(this.element, journey); }
      catch { return; }
      journey.campDefaults ??= {};
      journey.campDefaults.watches = structuredClone(journey.currentDay.campWatches);
      journey.currentDay.campfire = Boolean(this.element.querySelector("[name='campfire']")?.checked);
      await saveActiveJourney(journey);
    });
    if (!panel) return;
    for (const row of panel.querySelectorAll(".journey-watch-row")) {
      const select = row.querySelector("select[name^='watchAction']");
      if (!select) continue;
      const period = row.querySelector("select[name^='watchPeriod']");
      const help = document.createElement("small");
      help.className = "journey-camp-action-help";
      const update = () => {
        help.textContent = CAMP_ACTION_HELP[select.value] ?? "";
        if (period) period.hidden = select.value !== "Take a Watch";
        const additionalPeriod = row.querySelector("select[name^='additionalWatchPeriod']");
        if (additionalPeriod) additionalPeriod.hidden = select.value !== "Take a Watch" || additionalPeriod.dataset.additionalWatchAvailable !== "true";
      };
      select.addEventListener("change", update);
      update();
      row.append(help);
    }
    const campfire = panel.querySelector("[name='campfire']");
    const fireActions = new Set(["Craft", "Cook", "Prepare"]);
    const syncFireRequirements = () => {
      for (const select of panel.querySelectorAll("select[name^='watchAction']")) {
        for (const option of select.options) option.disabled = !campfire.checked && fireActions.has(option.value);
        if (!campfire.checked && fireActions.has(select.value)) {
          select.value = "Slumber";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    };
    campfire?.addEventListener("change", syncFireRequirements);
    syncFireRequirements();
    const craftCallout = document.createElement("div");
    craftCallout.className = "ml-callout journey-craft-notice";
    craftCallout.dataset.tone = "success";
    const craftNotice = document.createElement("p");
    craftNotice.innerHTML = "<strong>Player action required:</strong> Tell each character assigned to Craft to open Morelord Craftworks and perform their Craft action.";
    craftCallout.append(craftNotice);
    const syncCraft = () => {
      const selected = Array.from(panel.querySelectorAll("select[name^='watchAction']")).some(select => select.value === "Craft");
      craftCallout.hidden = !selected;
    };
    panel.querySelectorAll("select[name^='watchAction']").forEach(select => select.addEventListener("change", syncCraft));
    syncCraft();
    const cook = document.createElement("div");
    cook.className = "journey-cook-resolution";
    const travelers = Array.from(panel.querySelectorAll(".journey-watch-row")).map(row => ({ value: row.dataset.actorUuid, label: row.querySelector("strong")?.textContent ?? "" }));
    const options = `<option value="">No recipient</option>${travelers.map(option => `<option value="${option.value}">${foundry.utils.escapeHTML(option.label)}</option>`).join("")}`;
    cook.innerHTML = `<p>After verbally resolving a successful Cook action, select up to two recipients.</p><select name="cookRecipient1">${options}</select><select name="cookRecipient2">${options}</select><button type="button" data-action="resolveCookSuccess">Record Successful Cooking (-1 Exhaustion each)</button>`;
    const syncCook = () => { cook.hidden = !Array.from(panel.querySelectorAll("select[name^='watchAction']")).some(select => select.value === "Cook"); };
    panel.querySelectorAll("select[name^='watchAction']").forEach(select => select.addEventListener("change", syncCook));
    syncCook();
    panel.append(craftCallout, cook);
  }

  #renderCampSleep(context) {
    if (!sleepAndShelterEnabled()) return;
    const anchor = this.element.querySelector(".journey-phase-card > [data-action='advancePhase']");
    if (!anchor) return;
    anchor.disabled = true;
    anchor.dataset.tooltip = "Complete every sleep check before continuing.";
    const sleepBaseDC = getDCConfiguration().sleepBase;
    const section = document.createElement("section");
    section.className = "journey-camp-sleep";
    const night = context.journey.currentDay?.nightEncounterCheck;
    const nightLabel = { peacefulRest: "Peaceful Rest", uneventful: "Uneventful Night", minor: "Minor Encounter", nightAttack: "Night Attack" }[night?.outcome] ?? "Night result unavailable";
    section.dataset.cold = String(Boolean(context.journey.currentDay?.phases?.weather?.cold));
    section.innerHTML = `<div class="journey-sleep-intro"><p>Weather and temperature are applied automatically from the Weather phase. Each traveler may select only sleeping equipment in their own inventory.</p><button type="button" class="ml-icon-button journey-help-button" data-size="compact" data-variant="ghost" data-sleep-help aria-label="Explain sleep and interruption outcomes" data-tooltip="Explain sleep and interruption outcomes"><i class="fa-solid fa-circle-question"></i></button></div><div class="journey-night-confirmation"><small>Night encounter result</small><strong>${nightLabel}</strong><span>${night?.pendingSleepConfirmation ? "Pending confirmation with the sleep results" : "Confirmed"}</span></div><div class="journey-camp-sleep-list"></div>`;
    section.querySelector("[data-sleep-help]").addEventListener("click", event => {
      event.preventDefault();
      void foundry.applications.api.DialogV2.prompt({ window: { title: "Sleep, Interruptions, and Long Rests", icon: "fa-solid fa-circle-question" }, content: "<div class='ml-journeys-help-content'><section><h3>Sleep Hours</h3><ul><li>Start at 8 hours.</li><li>Lose 2 hours per watch or non-Slumber action.</li><li>Interruption time comes from Night Encounters.</li></ul></section><section><h3>Long Rest</h3><ul><li>Pass the sleep check.</li><li>Meet required sleep hours.</li><li>Have less than 1 interrupted hour.</li></ul></section><section><h3>Other Effects</h3><ul><li>Peaceful Rest: −5 sleep DC.</li><li>Missing a Long Rest may require a deprivation save.</li><li>Food or water shortages prevent Exhaustion recovery.</li></ul></section></div>", ok: { label: "Close" } });
    });
    const list = section.querySelector(".journey-camp-sleep-list");
      for (const traveler of context.journey.travelers) {
        const owned = Object.fromEntries(["tent", "bedroll", "blanket"].map(gear => [gear, (context.journey.supplies?.items ?? []).some(item => item.sourceActorUuid === traveler.actorUuid && item.sourceType !== "group" && item.category === gear && item.availableQuantity > 0)]));
        const options = shelterOptions(owned).map(entry => `<option value="${entry.value}">${entry.label}</option>`).join("");
        const row = document.createElement("div");
        row.className = "journey-camp-sleep-row";
        row.dataset.actorUuid = traveler.actorUuid;
        row.dataset.requiredSleepHours = String(traveler.longRestHours ?? 6);
        row.innerHTML = `<header class="journey-sleep-character"><strong>${foundry.utils.escapeHTML(traveler.name)}</strong><span class="journey-sleep-dc">Sleep DC ${sleepBaseDC} · Long Rest requires ${traveler.longRestHours ?? 6}h</span></header><div class="journey-sleep-controls"><div class="journey-shelter-group"><span class="journey-control-label">Sleeping setup</span><div class="journey-shelter-choices"><select data-shelter-select aria-label="Sleeping setup for ${foundry.utils.escapeHTML(traveler.name)}">${options}</select><button type="button" class="ml-icon-button journey-help-button" data-size="compact" data-variant="ghost" data-shelter-help aria-label="Explain shelter bonuses" data-tooltip="Explain shelter bonuses"><i class="fa-solid fa-circle-question"></i></button></div></div><label class="journey-sleep-hours"><span>Sleep hours</span><input type="number" data-sleep-hours min="0" max="8" step="0.5" value="8"></label><div class="journey-readonly-value"><span>Interrupted</span><strong data-interruption-display>0 hours</strong></div></div>`;
        row.querySelector("[data-shelter-help]").addEventListener("click", event => {
          event.preventDefault();
          void foundry.applications.api.DialogV2.prompt({ window: { title: "Shelter and Sleep DC", icon: "fa-solid fa-circle-question" }, content: "<div class='ml-journeys-help-content'><section><h3>DC Modifiers</h3><ul><li>Owned tent: −5</li><li>Owned bedroll: −2</li><li>Owned blanket in cold weather: −1</li><li>Extreme weather: +5</li><li>Peaceful night: −5</li></ul></section><section><h3>Ownership</h3><ul><li>Sleeping equipment is never pooled.</li></ul></section></div>", ok: { label: "Close" } });
        });
        list.append(row);
    }
    const recalculate = () => {
      const cold = section.dataset.cold === "true";
      for (const row of list.children) {
        const equipment = selectedShelter(row);
        let dc = sleepBaseDC;
        if (equipment.tent) dc -= 5;
        if (equipment.bedroll) dc -= 2;
        if (cold && equipment.blanket) dc -= 1;
        const extreme = Boolean(row.closest(".journey-camp-sleep")?.dataset.extreme === "true");
        if (extreme) dc += 5;
        if (row.closest(".journey-camp-sleep")?.dataset.peaceful === "true") dc -= 5;
        row.querySelector(".journey-sleep-dc").textContent = `Sleep DC ${Math.max(0, dc)} · Long Rest requires ${row.dataset.requiredSleepHours}h`;
      }
    };
    section.querySelectorAll("input, select").forEach(input => input.addEventListener("change", recalculate));
    const roll = document.createElement("button");
    roll.type = "button";
    roll.dataset.action = "rollCampSleep";
    roll.textContent = "Request Party Sleep Checks";
    section.append(roll);
    anchor.before(section);
    recalculate();
    void getActiveJourney().then(active => {
      const saved = active?.currentDay?.campSleepPlan;
      if (!this.rendered) return;
      section.dataset.cold = String(Boolean(active.currentDay?.phases?.weather?.cold ?? saved?.coldWeather));
      section.dataset.extreme = String(Boolean(active.currentDay?.phases?.weather?.extreme));
      section.dataset.peaceful = String(active.currentDay?.nightEncounterCheck?.outcome === "peacefulRest");
      const entries = saved?.entries ?? active.travelers.map(traveler => ({
        actorUuid: traveler.actorUuid,
        equipment: Object.fromEntries(["tent", "bedroll", "blanket"].map(gear => [gear, (active.supplies?.items ?? []).some(item => item.sourceActorUuid === traveler.actorUuid && item.category === gear && item.availableQuantity > 0)]))
      }));
      for (const entry of entries) {
        const row = section.querySelector(`[data-actor-uuid='${entry.actorUuid}']`);
        if (!row) continue;
        const savedSetup = ["tent", "bedroll", "blanket"].filter(gear => entry.equipment?.[gear]).join("+");
        const select = row.querySelector("[data-shelter-select]");
        select.value = Array.from(select.options).some(option => option.value === savedSetup) ? savedSetup : "";
        row.querySelector("[data-sleep-hours]").value = entry.sleepHours ?? availableCampSleepHours(active.currentDay?.campWatches, entry.actorUuid);
        const encounterHours = (active.currentDay?.sleepInterruptions ?? [])
          .filter(item => item.actorUuid === entry.actorUuid)
          .reduce((total, item) => total + Math.max(0, Number(item.hours ?? Number(item.minutes ?? 0) / 60)), 0);
        const savedInterruptionHours = entry.interruptionHours ?? Number(entry.interruptionMinutes ?? 0) / 60;
        row.querySelector("[data-interruption-display]").textContent = `${Math.max(Number(savedInterruptionHours), encounterHours)} hours`;
      }
      recalculate();
      const pendingSleep = active.currentDay?.pendingSleepRolls ?? [];
      const sleepWasRequested = pendingSleep.length > 0 || (active.currentDay?.campSleepResults?.length ?? 0) > 0;
      roll.hidden = sleepWasRequested;
      roll.disabled = sleepWasRequested;
      roll.textContent = pendingSleep.length > 0 ? "Sleep Checks Pending" : "Request Party Sleep Checks";
      if (pendingSleep.length) {
        const pending = document.createElement("div");
        pending.className = "journey-sleep-result-list";
        pending.innerHTML = pendingSleep.map(request => `<article class="journey-sleep-result"><header><strong>${foundry.utils.escapeHTML(request.actorName)}</strong><span>${request.kind === "deprivation" ? "Sleep deprivation" : "Sleep check"} · DC ${request.dc} pending</span></header><div class="ml-cluster"><button type="button" data-action="resendSleepRoll" data-request-id="${request.id}">Resend</button><button type="button" data-action="autoSleepFailure" data-request-id="${request.id}">Fail</button><button type="button" data-action="autoSleepSuccess" data-request-id="${request.id}">Succeed</button></div></article>`).join("");
        section.append(pending);
      }
      if (active.currentDay?.campSleepResults?.length) {
        const summary = document.createElement("div");
        summary.className = "journey-sleep-results";
        summary.innerHTML = `<h4>Sleep Check Results</h4><div class="journey-sleep-result-list">${active.currentDay.campSleepResults.map(result => {
          const state = result.longRestCompleted ? "is-success" : result.succeeded ? "is-warning" : "is-failure";
          const status = result.longRestCompleted ? "Sleep check passed · Long Rest completed" : `${result.succeeded ? "Sleep check passed" : "Sleep check failed"} · No Long Rest`;
          return `<article class="journey-sleep-result ${state}"><header><strong>${foundry.utils.escapeHTML(result.actorName)}</strong><span>${status}</span></header><p class="journey-result-consequence">${foundry.utils.escapeHTML(result.consequence)}</p></article>`;
        }).join("")}</div>`;
        summary.append(createOutcomeDetails({ cards: active.currentDay.campSleepResults.map(result => ({ title: result.actorName, rows: [
          { label: "Sleep check roll", value: result.total },
          { label: "Base DC", value: result.baseDC },
          ...(result.modifiers ?? []).map(modifier => ({ label: SLEEP_MODIFIER_LABELS[modifier.id] ?? modifier.id, value: `${modifier.value >= 0 ? "+" : ""}${modifier.value}` })),
          { label: "Final DC", value: result.dc },
          { label: "Sleep check outcome", value: result.automatic ? `${result.succeeded ? "Success" : "Failure"} — manually set by GM` : result.succeeded ? `Success — ${result.total} meets final DC ${result.dc}` : `Failure — ${result.total} is below final DC ${result.dc}` },
          { label: "Sleep", value: `${result.sleepHours ?? 0} hours` },
          { label: "Required sleep for Long Rest", value: `${result.requiredSleepHours ?? 6} hours` },
          { label: "Requirement source", value: result.requiredSleepHoursSource ?? "Standard Long Rest sleep requirement" },
          { label: "Interrupted", value: `${result.interruptionHours ?? Number(result.interruptionMinutes ?? 0) / 60} hours` },
          { label: "Interruption source", value: describeInterruptionSources(result, active.currentDay) },
          { label: "Long Rest", value: result.longRestCompleted ? "Completed" : "Not completed" },
          { label: "Long Rest determination", value: result.longRestCompleted ? `All requirements met: successful sleep check, at least ${result.requiredSleepHours ?? 6} sleep hours, and less than 1 interrupted hour.` : `Requirements not met: ${longRestFailureReasons({ sleepCheckSucceeded: result.succeeded, sleepHours: result.sleepHours, requiredSleepHours: result.requiredSleepHours, interruptionHours: result.interruptionHours }).join("; ")}.` },
          { label: "Exhaustion change", value: result.exhaustionChange > 0 ? `+${result.exhaustionChange}` : result.exhaustionChange }
        ] })) }));
        section.append(summary);
      }
      const eligible = active.currentDay?.peacefulRestEligible ?? [];
      if (eligible.length) {
        const choices = document.createElement("div");
        choices.className = "journey-peaceful-rest";
        choices.innerHTML = `<h4>Peaceful Rest Benefits</h4><p>Players choose these benefits. Journeys records the selections but does not apply them mechanically.</p><div class="journey-peaceful-choice-list">${eligible.map(actorUuid => { const traveler = active.travelers.find(item => item.actorUuid === actorUuid); const choice = active.currentDay?.peacefulRestChoices?.find(item => item.actorUuid === actorUuid); const pending = active.currentDay?.pendingPeacefulRestChoices?.find(item => item.actorUuid === actorUuid); return `<article data-peaceful-actor="${actorUuid}"><strong>${foundry.utils.escapeHTML(traveler?.name ?? "Traveler")}</strong>${choice ? `<span class="journey-peaceful-selection">${foundry.utils.escapeHTML(choice.label)}</span>` : pending ? `<div class="journey-peaceful-pending"><span>Awaiting player selection</span><select aria-label="Peaceful Rest benefit for ${foundry.utils.escapeHTML(traveler?.name ?? "Traveler")}"><option value="firstSaveAdvantage">Advantage on the first saving throw tomorrow</option><option value="exhaustion">Remove one additional level of Exhaustion</option><option value="inspiration">Gain Heroic Inspiration</option></select><div class="ml-cluster journey-peaceful-actions"><button type="button" data-action="resendPeacefulRest" data-request-id="${pending.id}">Resend</button><button type="button" data-action="setPeacefulRest" data-request-id="${pending.id}">GM Set</button></div></div>` : `<span>Selection not requested</span>`}</article>`; }).join("")}</div>`;
        section.append(choices);
      }
      const sleepComplete = (active.currentDay?.campSleepResults?.length ?? 0) >= active.travelers.length
        && pendingSleep.length === 0
        && (active.currentDay?.pendingPeacefulRestChoices?.length ?? 0) === 0;
      anchor.disabled = !sleepComplete;
      anchor.dataset.tooltip = sleepComplete ? "Continue to the next phase." : "Complete every sleep check and Peaceful Rest choice before continuing.";
    });
  }

  #renderForaging(context) {
    const notes = this.element.querySelector(".journey-phase-card > [data-action='advancePhase']");
    if (!notes) return;
    const craftworks = this.element.querySelector(".journey-craftworks-integration");
    if (craftworks) {
      craftworks.querySelector("strong").textContent = "Optional Exploration Activities";
      craftworks.querySelector("p").textContent = "This is a good opportunity for characters to gather materials, search the surrounding area, investigate local features, or perform other exploration activities. These activities are separate from food-and-water foraging checks and can be supported by Morelord Craftworks.";
      const button = craftworks.querySelector("[data-action='openCraftworksGather']");
      if (button) {
        button.textContent = "Launch Morelord Craftworks";
        button.classList.add("ml-button");
        delete button.dataset.tone;
      }
    }

    const saved = context.journey.currentDay?.foragingResolution;
    const panel = document.createElement("section");
    panel.className = "ml-card ml-stack journey-foraging-check";
    panel.innerHTML = `<header><h3>Forage for Food & Water</h3><p>Each traveler makes a Survival check against Resources DC ${context.route.resourcesDC}. Players receive individual roll requests; the GM can resolve pending checks manually.</p></header>`;
    const list = document.createElement("div");
    list.className = "journey-forager-list";
    const pending = context.journey.currentDay?.pendingForagingRolls ?? [];
    const results = context.journey.currentDay?.foragingResults ?? [];
    for (const traveler of context.journey.travelers) {
      const row = document.createElement("div");
      row.className = "journey-forager-row";
      const image = document.createElement("img");
      image.src = traveler.img;
      image.alt = "";
      const name = document.createElement("strong");
      name.className = "journey-forager-name";
      name.textContent = traveler.name;
      const request = pending.find(candidate => candidate.actorUuid === traveler.actorUuid);
      const result = results.find(candidate => candidate.actorUuid === traveler.actorUuid);
      const status = document.createElement("span");
      status.className = "ml-status journey-forager-status";
      if (result) status.dataset.tone = result.succeeded ? "success" : "danger";
      status.textContent = request ? "Pending" : result ? `${result.succeeded ? "Success" : "Failure"}${result.automatic ? " · GM" : ` · ${result.total}`}` : "Not requested";
      row.append(image, name, status);
      if (request) {
        const actions = document.createElement("div");
        actions.className = "journey-forager-actions";
        for (const [action, label] of [["resendForagingRoll", "Resend"], ["autoForagingFailure", "Fail"], ["autoForagingSuccess", "Succeed"]]) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.action = action;
          button.dataset.requestId = request.id;
          button.textContent = label;
          actions.append(button);
        }
        row.append(actions);
      }
      list.append(row);
    }
    panel.append(list);
    if (results.length) {
      panel.append(createOutcomeDetails({ cards: results.map(result => ({ title: result.actorName, rows: [
        { label: "Resources DC", value: result.dc },
        { label: "Survival roll", value: result.automatic ? "Manually set by GM" : result.total },
        { label: "Natural d20", value: result.automatic ? null : result.natural },
        { label: "Check outcome", value: result.succeeded ? "Success" : "Failure" },
        { label: "Food found", value: `${result.foodFound ?? 0} ration${Number(result.foodFound ?? 0) === 1 ? "" : "s"}` },
        { label: "Water outcome", value: result.succeeded ? "Found a water source for the entire party" : "No water source found by this traveler" }
      ] })) }));
    }
    if (!pending.length && results.length < context.journey.travelers.length) {
      const request = document.createElement("button");
      request.type = "button";
      request.dataset.action = "requestForagingRolls";
      request.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Request Party Foraging Rolls';
      panel.append(request);
    }
    if (saved) {
      const summary = document.createElement("div");
      summary.className = "journey-foraging-summary";
      const excess = Object.values(saved.excessFoodByActorUuid ?? {}).reduce((total, amount) => total + Number(amount), 0);
      summary.innerHTML = `<strong>Foraging outcome:</strong> ${saved.totalFoodFound ?? saved.successfulActorUuids?.length ?? 0} food found; ${saved.foodRequired} ration(s) still required; ${saved.waterRequired} pint(s) of water required.${saved.waterSourceFound ? " A forager found water for everyone; carried water is not consumed and containers may be refilled." : ""}${excess ? ` ${excess} excess ration(s) added to the successful forager inventories.` : ""}<br><small>Expedition pool: ${context.journey.supplies?.totals?.food ?? 0} food, ${context.journey.supplies?.totals?.water ?? 0} water pints.</small>`;
      panel.append(summary);
      if (!pending.length && results.length >= context.journey.travelers.length && !context.journey.currentDay?.supplyResolution) {
        this.#renderSupplyAllocation(panel, context, saved);
      }
      if (context.journey.currentDay?.supplyResolution) {
        const resolution = document.createElement("div");
        resolution.className = "journey-foraging-summary";
        const applied = context.journey.currentDay.supplyResolution;
        resolution.innerHTML = `<strong>Supplies resolved${applied.resolutionMode === "manual" ? " manually without inventory changes" : " and consumed from inventory"}.</strong> Remaining shortages: ${applied.shortages.food} food, ${applied.shortages.water} water.`;
        panel.append(resolution);
        this.#renderSupplyConsequences(panel, context);
      }
    }
    const continueButton = this.element.querySelector("[data-action='advancePhase']");
    if (continueButton) {
      const complete = results.length >= context.journey.travelers.length
        && pending.length === 0
        && Boolean(context.journey.currentDay?.supplyResolution)
        && Boolean(context.journey.currentDay?.supplyConsequences?.resolved);
      continueButton.disabled = !complete;
      continueButton.dataset.tooltip = complete ? "Continue to Camp" : "Resolve every traveler's foraging check before continuing.";
    }
    (craftworks ?? notes).before(panel);
  }

  #renderSupplyConsequences(panel, context) {
    const consequences = context.journey.currentDay?.supplyConsequences;
    if (!consequences) {
      const resolving = document.createElement("p");
      resolving.textContent = "Applying daily hunger and water outcomes…";
      panel.append(resolving);
      return;
    }
    const section = document.createElement("div");
    section.className = "journey-supply-allocation";
    section.innerHTML = `<h4>Supply Consequences</h4><p>${consequences.waterActorUuids.length} traveler(s) lacked water and gained Exhaustion automatically.</p>`;
    for (const hunger of consequences.hungerResults ?? []) {
      const row = document.createElement("p");
      row.textContent = hunger.ateFullMeal
        ? `${hunger.actorName} ate a full meal; hunger reset.`
        : `${hunger.actorName}: ${hunger.daysWithoutFood} day(s) without food; ${hunger.threshold} day(s) allowed${hunger.saveRequired ? `; DC ${hunger.dc} Constitution save required` : "; no save required yet"}.`;
      section.append(row);
    }
    for (const request of context.journey.currentDay?.pendingSupplySaves ?? []) {
      const row = document.createElement("div");
      row.className = "journey-supply-save-row";
      const label = document.createElement("span");
      label.textContent = `${request.actorName}: DC ${request.dc} Constitution save pending`;
      row.append(label);
      for (const [action, text] of [["autoSupplySaveFailure", "Fail"], ["autoSupplySaveSuccess", "Succeed"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.action = action;
        button.dataset.requestId = request.id;
        button.textContent = text;
        row.append(button);
      }
      section.append(row);
    }
    if (consequences.resolved) {
      const done = document.createElement("strong");
      done.textContent = "All shortage consequences resolved.";
      section.append(done);
    }
    panel.append(section);
  }

  #renderSupplyAllocation(panel, context, requirements) {
    const waterActorUuids = requirements.successfulActorUuids.length
      ? []
      : context.journey.travelers.map(traveler => traveler.actorUuid);
    const foodNeeded = requirements.foodActorUuids ?? requirements.failedActorUuids;
    const availableFood = (context.journey.supplies?.items ?? []).filter(item => item.category === "food").reduce((total, item) => total + Number(item.availableQuantity ?? 0), 0);
    const savedRecipients = (context.journey.currentDay?.foodRecipientSelection ?? []).filter(uuid => foodNeeded.includes(uuid));
    const selectedFoodRecipients = availableFood < foodNeeded.length
      ? (savedRecipients.length ? savedRecipients : foodNeeded.slice(0, availableFood))
      : foodNeeded;
    const plan = supplyConsumption.planForTravelers(context.journey.supplies, {
      travelers: context.journey.travelers,
      foodActorUuids: selectedFoodRecipients,
      waterActorUuids
    });
    plan.shortageActorUuids.food.push(...foodNeeded.filter(uuid => !selectedFoodRecipients.includes(uuid)));
    plan.shortageActorUuids.food = [...new Set(plan.shortageActorUuids.food)];
    plan.shortages.food = plan.shortageActorUuids.food.length;
    const section = document.createElement("div");
    section.className = "journey-supply-allocation";
    const heading = document.createElement("h4");
    heading.textContent = "Allocate Daily Supplies";
    const explanation = document.createElement("p");
    explanation.textContent = "Food and water are pooled across traveler and Group inventories. Review every source before confirming consumption.";
    section.append(heading, explanation);
    if (availableFood > 0 && availableFood < foodNeeded.length) {
      const chooser = document.createElement("fieldset");
      chooser.className = "ml-field-group journey-food-recipient-choice";
      chooser.innerHTML = `<legend>Who Receives Food?</legend><p>${availableFood} ration(s) are available for ${foodNeeded.length} travelers. Select up to ${availableFood}.</p>${foodNeeded.map(actorUuid => { const traveler = context.journey.travelers.find(item => item.actorUuid === actorUuid); return `<label><input type="checkbox" data-food-recipient="${actorUuid}" ${selectedFoodRecipients.includes(actorUuid) ? "checked" : ""}> ${foundry.utils.escapeHTML(traveler?.name ?? "Traveler")}</label>`; }).join("")}`;
      chooser.addEventListener("change", async event => {
        if (!event.target.matches("[data-food-recipient]")) return;
        const selected = Array.from(chooser.querySelectorAll("[data-food-recipient]:checked"), input => input.dataset.foodRecipient);
        if (selected.length > availableFood) {
          event.target.checked = false;
          ui.notifications.warn(`Only ${availableFood} ration(s) are available.`);
          return;
        }
        const journey = await getActiveJourney();
        journey.currentDay.foodRecipientSelection = Array.from(chooser.querySelectorAll("[data-food-recipient]:checked"), input => input.dataset.foodRecipient);
        await saveActiveJourney(journey);
        await this.render({ force: true });
      });
      section.append(chooser);
    }
    plan.allocations.forEach((allocation, index) => {
      const row = document.createElement("div");
      row.className = "journey-supply-allocation-row";
      const text = document.createElement("span");
      const source = allocation.sourceType === "group" ? `${allocation.sourceActorName} (Group inventory)` : `${allocation.sourceActorName}'s inventory`;
      text.textContent = `${allocation.consumerActorName}: ${allocation.quantity} ${allocation.category} from ${source}`;
      row.append(text);
      section.append(row);
    });
    const unknownWater = (context.journey.supplies?.items ?? []).filter(item => item.category === "water" && item.supplyState === "unknown");
    if (unknownWater.length) {
      const warning = document.createElement("p");
      warning.className = "ml-text journey-supply-warning";
      warning.dataset.tone = "warning";
      warning.textContent = `${unknownWater.length} water container(s) have unknown fill state and are not counted. Mark them full through item uses/charges or Morelord water flags before refreshing.`;
      section.append(warning);
    }
    const shortages = document.createElement("p");
    const shortNames = [...plan.shortageActorUuids.food, ...plan.shortageActorUuids.water]
      .map(uuid => context.journey.travelers.find(traveler => traveler.actorUuid === uuid)?.name)
      .filter(Boolean);
    shortages.textContent = shortNames.length
      ? `The current inventories cannot cover everyone. Shortages remain for: ${[...new Set(shortNames)].join(", ")}. Update a character or Group inventory and refresh the Supply Manifest, or check the manual-supply confirmations below when the party obtains supplies outside tracked inventories.`
      : "Everyone who needs supplies is covered.";
    section.append(shortages);
    for (const actorUuid of new Set([...plan.shortageActorUuids.food, ...plan.shortageActorUuids.water])) {
      const traveler = context.journey.travelers.find(item => item.actorUuid === actorUuid);
      const manual = document.createElement("div");
      manual.className = "journey-manual-supplies";
      if (plan.shortageActorUuids.food.includes(actorUuid)) manual.innerHTML += `<label><input type="checkbox" data-manual-food="${actorUuid}"> ${foundry.utils.escapeHTML(traveler?.name ?? "Traveler")} receives a manual ration</label>`;
      if (plan.shortageActorUuids.water.includes(actorUuid)) manual.innerHTML += `<label><input type="checkbox" data-manual-water="${actorUuid}"> ${foundry.utils.escapeHTML(traveler?.name ?? "Traveler")} receives 4 manual pints</label>`;
      section.append(manual);
    }
    const apply = document.createElement("button");
    apply.type = "button";
    apply.dataset.action = "consumeTravelSupplies";
    apply.innerHTML = '<i class="fa-solid fa-utensils"></i> Confirm & Consume Supplies';
    const exception = document.createElement("details");
    exception.className = "journey-supply-exception";
    exception.innerHTML = `<summary>Resolve an Exception</summary><div class="ml-stack"><p>Use this when supplies were handled outside tracked inventories or the proposed consumption should not be applied. Journeys will record the selected outcomes without changing inventory.</p><div class="journey-manual-outcome-list">${context.journey.travelers.map(traveler => `<div class="journey-manual-outcome-row"><strong>${foundry.utils.escapeHTML(traveler.name)}</strong><label><input type="checkbox" data-exception-food="${traveler.actorUuid}" checked> Ate a full day’s food</label><label><input type="checkbox" data-exception-water="${traveler.actorUuid}" checked> Drank the required water</label></div>`).join("")}</div><button type="button" data-action="resolveTravelSuppliesManually"><i class="fa-solid fa-clipboard-check"></i> Record Manual Supply Outcomes</button></div>`;
    section.append(apply, exception);
    panel.append(section);
  }

  static async requestForagingRolls(event) {
    event.preventDefault();
    try {
      await foragingRollService.requestParty();
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async autoForagingSuccess(event, target) {
    event.preventDefault();
    try { await foragingRollService.autoResolve(target.dataset.requestId, true); await this.render({ force: true }); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async autoForagingFailure(event, target) {
    event.preventDefault();
    try { await foragingRollService.autoResolve(target.dataset.requestId, false); await this.render({ force: true }); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async resendForagingRoll(event, target) {
    event.preventDefault();
    try { await foragingRollService.resend(target.dataset.requestId); await this.render({ force: true }); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async consumeTravelSupplies(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      const requirements = journey.currentDay?.foragingResolution;
      if (!requirements) throw new Error("Resolve foraging before consuming supplies.");
      journey.supplies = await supplyManifest.build({
        travelerUuids: journey.travelers.map(traveler => traveler.actorUuid),
        partyActorUuid: journey.partyActorUuid
      });
      const plan = supplyConsumption.planForTravelers(journey.supplies, {
        travelers: journey.travelers,
        foodActorUuids: this.element.querySelector("[data-food-recipient]")
          ? Array.from(this.element.querySelectorAll("[data-food-recipient]:checked"), input => input.dataset.foodRecipient)
          : requirements.foodActorUuids ?? requirements.failedActorUuids,
        waterActorUuids: requirements.successfulActorUuids.length ? [] : journey.travelers.map(traveler => traveler.actorUuid)
      });
      const foodNeeded = requirements.foodActorUuids ?? requirements.failedActorUuids;
      const selectedFood = this.element.querySelector("[data-food-recipient]")
        ? Array.from(this.element.querySelectorAll("[data-food-recipient]:checked"), input => input.dataset.foodRecipient)
        : foodNeeded;
      plan.shortageActorUuids.food.push(...foodNeeded.filter(uuid => !selectedFood.includes(uuid)));
      plan.shortageActorUuids.food = [...new Set(plan.shortageActorUuids.food)];
      plan.shortages.food = plan.shortageActorUuids.food.length;
      const manualFood = new Set(Array.from(this.element.querySelectorAll("[data-manual-food]:checked"), input => input.dataset.manualFood));
      const manualWater = new Set(Array.from(this.element.querySelectorAll("[data-manual-water]:checked"), input => input.dataset.manualWater));
      plan.shortageActorUuids.food = plan.shortageActorUuids.food.filter(uuid => !manualFood.has(uuid));
      plan.shortageActorUuids.water = plan.shortageActorUuids.water.filter(uuid => !manualWater.has(uuid));
      plan.shortages.food = plan.shortageActorUuids.food.length;
      plan.shortages.water = plan.shortageActorUuids.water.length;
      plan.manual = { foodActorUuids: [...manualFood], waterActorUuids: [...manualWater] };
      await supplyConsumption.apply(plan);
      plan.refilledWaterContainers = requirements.refilledWaterContainers ?? [];
      journey.currentDay.supplyResolution = { ...plan, resolvedAt: Date.now() };
      journey.supplies = await supplyManifest.build({
        travelerUuids: journey.travelers.map(traveler => traveler.actorUuid),
        partyActorUuid: journey.partyActorUuid
      });
      await saveActiveJourney(journey);
      await supplyConsequenceService.begin();
      ui.notifications.info("Daily supplies and their hunger and water outcomes were resolved.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async resolveTravelSuppliesManually(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      const requirements = journey.currentDay?.foragingResolution;
      if (!requirements) throw new Error("Resolve foraging before recording supply outcomes.");
      const fed = new Set(Array.from(this.element.querySelectorAll("[data-exception-food]:checked"), input => input.dataset.exceptionFood));
      const watered = new Set(Array.from(this.element.querySelectorAll("[data-exception-water]:checked"), input => input.dataset.exceptionWater));
      journey.currentDay.supplyResolution = {
        ...supplyConsumption.planManualOutcomes({ travelers: journey.travelers, fedActorUuids: [...fed], wateredActorUuids: [...watered] }),
        refilledWaterContainers: requirements.refilledWaterContainers ?? [],
        resolvedAt: Date.now()
      };
      await saveActiveJourney(journey);
      await supplyConsequenceService.begin();
      ui.notifications.info("Manual daily supply outcomes were recorded without changing inventory.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async autoSupplySaveSuccess(event, target) {
    event.preventDefault();
    try { await supplyConsequenceService.autoResolve(target.dataset.requestId, true); await this.render({ force: true }); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async autoSupplySaveFailure(event, target) {
    event.preventDefault();
    try { await supplyConsequenceService.autoResolve(target.dataset.requestId, false); await this.render({ force: true }); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async saveCampSleepPlan(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      const assignments = {};
      for (const row of this.element.querySelectorAll(".journey-camp-sleep-row")) {
        assignments[row.dataset.actorUuid] = selectedShelter(row);
      }
      journey.currentDay.campSleepPlan = campSupplies.buildSleepPlan({
        travelers: journey.travelers,
        supplies: journey.supplies,
        assignments,
        extremeWeather: Boolean(journey.currentDay.phases?.weather?.extreme),
        coldWeather: Boolean(journey.currentDay.phases?.weather?.cold),
        peacefulNight: journey.currentDay?.nightEncounterCheck?.outcome === "peacefulRest",
        baseDC: getDCConfiguration().sleepBase
      });
      for (const entry of journey.currentDay.campSleepPlan.entries) {
        const row = this.element.querySelector(`.journey-camp-sleep-row[data-actor-uuid='${entry.actorUuid}']`);
        entry.sleepHours = Number(row?.querySelector("[data-sleep-hours]")?.value ?? 8);
        const recorded = (journey.currentDay?.sleepInterruptions ?? []).filter(item => item.actorUuid === entry.actorUuid);
        entry.interruptionSources = recorded.map(item => ({ reason: item.reason ?? "recorded interruption", hours: Number(item.hours ?? Number(item.minutes ?? 0) / 60), watchIndex: Number.isInteger(Number(item.watchIndex)) ? Number(item.watchIndex) : null }));
        entry.interruptionHours = entry.interruptionSources.reduce((total, item) => total + item.hours, 0);
      }
      await saveActiveJourney(journey);
      ui.notifications.info("Camp sleep plan saved.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async rollCampSleep(event) {
    event.preventDefault();
    const requestButton = event.target.closest("[data-action='rollCampSleep']");
    if (requestButton) requestButton.disabled = true;
    try {
      const journey = await getActiveJourney();
      const assignments = {};
      for (const row of this.element.querySelectorAll(".journey-camp-sleep-row")) assignments[row.dataset.actorUuid] = selectedShelter(row);
      const plan = campSupplies.buildSleepPlan({ travelers: journey.travelers, supplies: journey.supplies, assignments, extremeWeather: Boolean(journey.currentDay.phases?.weather?.extreme), coldWeather: Boolean(journey.currentDay.phases?.weather?.cold), peacefulNight: journey.currentDay?.nightEncounterCheck?.outcome === "peacefulRest", baseDC: getDCConfiguration().sleepBase });
      for (const entry of plan.entries) {
        const row = this.element.querySelector(`.journey-camp-sleep-row[data-actor-uuid='${entry.actorUuid}']`);
        entry.sleepHours = Number(row?.querySelector("[data-sleep-hours]")?.value ?? 8);
        const recorded = (journey.currentDay?.sleepInterruptions ?? []).filter(item => item.actorUuid === entry.actorUuid);
        entry.interruptionSources = recorded.map(item => ({ reason: item.reason ?? "recorded interruption", hours: Number(item.hours ?? Number(item.minutes ?? 0) / 60), watchIndex: Number.isInteger(Number(item.watchIndex)) ? Number(item.watchIndex) : null }));
        entry.interruptionHours = entry.interruptionSources.reduce((total, item) => total + item.hours, 0);
      }
      journey.currentDay.campSleepPlan = plan;
      journey.campDefaults ??= {};
      journey.campDefaults.sleepPlan = structuredClone(plan);
      await saveActiveJourney(journey);
      await sleepRollService.requestParty(plan);
      ui.notifications.info("Sleep check requests sent.");
      await this.render({ force: true });
    } catch (error) { if (requestButton) requestButton.disabled = false; ui.notifications.error(error.message); }
  }

  static async resendSleepRoll(event, target) {
    event.preventDefault();
    try { await sleepRollService.resend(target.dataset.requestId); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async autoSleepSuccess(event, target) {
    event.preventDefault();
    try { await sleepRollService.autoResolve(target.dataset.requestId, true); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async autoSleepFailure(event, target) {
    event.preventDefault();
    try { await sleepRollService.autoResolve(target.dataset.requestId, false); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async resolveCookSuccess(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      const actorUuids = [...new Set([this.element.querySelector("[name='cookRecipient1']")?.value, this.element.querySelector("[name='cookRecipient2']")?.value].filter(Boolean))].slice(0, 2);
      if (!actorUuids.length) throw new Error("Select at least one cooking recipient.");
      const recipients = [];
      for (const actorUuid of actorUuids) {
        const actor = await fromUuid(actorUuid);
        if (!actor) continue;
        const exhaustion = await adjustActorExhaustion(actor, -1);
        recipients.push({ actorUuid, actorName: actor.name, exhaustionChange: exhaustion.change });
      }
      journey.currentDay.cookResolution = { successful: true, recipients, resolvedAt: Date.now() };
      await saveActiveJourney(journey);
      ui.notifications.info("Successful Cook outcome recorded for up to two travelers.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async resendPeacefulRest(event, target) {
    event.preventDefault();
    try { await peacefulRestService.resend(target.dataset.requestId); await this.render({ force: true }); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async setPeacefulRest(event, target) {
    event.preventDefault();
    try {
      const choice = target.closest("[data-peaceful-actor]")?.querySelector("select")?.value;
      await peacefulRestService.autoResolve(target.dataset.requestId, choice);
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async resendForcedMarch(event, target) {
    event.preventDefault();
    try { await forcedMarchRollService.resend(target.dataset.requestId); await this.render({ force: true }); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async autoForcedMarchSuccess(event, target) {
    event.preventDefault();
    try { await forcedMarchRollService.autoResolve(target.dataset.requestId, true); await this.render({ force: true }); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async autoForcedMarchFailure(event, target) {
    event.preventDefault();
    try { await forcedMarchRollService.autoResolve(target.dataset.requestId, false); await this.render({ force: true }); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async setWaterState(event, target) {
    event.preventDefault();
    try {
      const item = await fromUuid(target.dataset.itemUuid);
      if (!item) throw new Error("That water container could not be found.");
      const full = target.dataset.waterState === "full";
      const capacity = SupplyManifestService.waterContainerPints(item);
      await item.update({
      "flags.morelord-journeys.waterState": full ? "full" : "empty",
      "flags.morelord-journeys.waterUnits": full ? capacity : 0
      });
      const journey = await getActiveJourney();
      journey.supplies = await supplyManifest.build({ travelerUuids: journey.travelers.map(traveler => traveler.actorUuid), partyActorUuid: journey.partyActorUuid });
      await saveActiveJourney(journey);
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }
}
