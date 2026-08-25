import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { foragingRollService } from "../services/foraging-roll-service.mjs";
import { SupplyConsumptionService } from "../services/supply-consumption-service.mjs";
import { SupplyManifestService } from "../services/supply-manifest-service.mjs";
import { supplyConsequenceService } from "../services/supply-consequence-service.mjs";
import { CampSupplyService } from "../services/camp-supply-service.mjs";
import { campPerceptionRollService } from "../services/camp-perception-roll-service.mjs";
import { peacefulRestService } from "../services/peaceful-rest-service.mjs";
import { MODULE_ID } from "../domain/constants.mjs";
import { sleepAndShelterEnabled, suppressSleepDeprivationExhaustion } from "../core/journey-settings.mjs";
import { qualifiesForLongRest, sleepDeprivationDC } from "../domain/sleep-rules.mjs";
import { forcedMarchRollService } from "../services/forced-march-roll-service.mjs";
import { JourneyFinalApplication as BaseJourneyApplication } from "./journey-final-app.mjs";
import { createOutcomeDetails } from "../ui/outcome-details.mjs";

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

async function rollConstitutionSave(actor, { dc, title, advantage = false } = {}) {
  if (typeof actor?.rollSavingThrow !== "function") throw new Error(`${actor?.name ?? "Traveler"} cannot make a D&D 5e Constitution saving throw.`);
  const native = await actor.rollSavingThrow(
    { ability: "con", target: dc, advantage },
    { configure: true, title },
    { create: true, data: { flavor: title } }
  );
  if (!native) return null;
  const roll = Array.isArray(native) ? native[0] : native?.rolls?.[0] ?? native?.roll ?? native;
  const total = Number(roll?.total ?? native?.total ?? Number.NaN);
  if (!Number.isFinite(total)) throw new Error("The Constitution saving throw did not return a numeric total.");
  return { roll, total };
}

export class JourneyForagingApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = { actions: {
    requestForagingRolls: this.requestForagingRolls,
    autoForagingSuccess: this.autoForagingSuccess,
    autoForagingFailure: this.autoForagingFailure,
    resendForagingRoll: this.resendForagingRoll,
    openCraftworksCraft: this.openCraftworksCraft,
    consumeTravelSupplies: this.consumeTravelSupplies,
    autoSupplySaveSuccess: this.autoSupplySaveSuccess,
    autoSupplySaveFailure: this.autoSupplySaveFailure,
    saveCampSleepPlan: this.saveCampSleepPlan,
    rollCampSleep: this.rollCampSleep,
    resendPeacefulRest: this.resendPeacefulRest,
    setPeacefulRest: this.setPeacefulRest,
    resolveCookSuccess: this.resolveCookSuccess,
    resendForcedMarch: this.resendForcedMarch,
    autoForcedMarchSuccess: this.autoForcedMarchSuccess,
    autoForcedMarchFailure: this.autoForcedMarchFailure,
    setWaterState: this.setWaterState
  } };

  #foragingUpdated = () => { if (this.rendered) void this.render({ force: true }); };
  #supplyUpdated = () => { if (this.rendered) void this.render({ force: true }); };
  #campPerceptionUpdated = () => { if (this.rendered) void this.render({ force: true }); };
  #peacefulRestUpdated = () => { if (this.rendered) void this.render({ force: true }); };
  #forcedMarchUpdated = () => { if (this.rendered) void this.render({ force: true }); };
  #sleepWindowExpanded = false;

  constructor(options = {}) {
    super(options);
    foragingRollService.addEventListener("updated", this.#foragingUpdated);
    supplyConsequenceService.addEventListener("updated", this.#supplyUpdated);
    campPerceptionRollService.addEventListener("updated", this.#campPerceptionUpdated);
    peacefulRestService.addEventListener("updated", this.#peacefulRestUpdated);
    forcedMarchRollService.addEventListener("updated", this.#forcedMarchUpdated);
  }

  async close(options = {}) {
    foragingRollService.removeEventListener("updated", this.#foragingUpdated);
    supplyConsequenceService.removeEventListener("updated", this.#supplyUpdated);
    campPerceptionRollService.removeEventListener("updated", this.#campPerceptionUpdated);
    peacefulRestService.removeEventListener("updated", this.#peacefulRestUpdated);
    forcedMarchRollService.removeEventListener("updated", this.#forcedMarchUpdated);
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
    checkbox.addEventListener("change", sync);
    sync();
  }
  #enhanceCampActions() {
    const panel = this.element.querySelector(".journey-camp-planner");
    panel?.addEventListener("change", async event => {
      if (!event.target.matches("select[name^='watchMember'], select[name^='watchAction'], [name='campfire']")) return;
      const journey = await getActiveJourney();
      journey.currentDay.campWatches = Array.from({ length: 4 }, (_, index) => {
        const actorUuid = this.element.querySelector(`[name='watchMember${index}']`)?.value ?? "";
        const traveler = journey.travelers.find(candidate => candidate.actorUuid === actorUuid);
        const prior = journey.currentDay.campWatches?.[index] ?? {};
        return { ...prior, index, actorUuid, actorName: traveler?.name ?? "Unassigned", action: this.element.querySelector(`[name='watchAction${index}']`)?.value ?? "Take a Watch" };
      });
      journey.campDefaults ??= {};
      journey.campDefaults.watches = structuredClone(journey.currentDay.campWatches);
      journey.currentDay.campfire = Boolean(this.element.querySelector("[name='campfire']")?.checked);
      await saveActiveJourney(journey);
    });
    if (!panel) return;
    for (const row of panel.querySelectorAll(".journey-watch-row")) {
      const select = row.querySelector("select[name^='watchAction']");
      if (!select) continue;
      const help = document.createElement("small");
      help.className = "journey-camp-action-help";
      const update = () => { help.textContent = CAMP_ACTION_HELP[select.value] ?? ""; };
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
    const craft = document.createElement("button");
    craft.type = "button";
    craft.dataset.action = "openCraftworksCraft";
    craft.className = "journey-emphasis-button";
    craft.innerHTML = '<i class="fa-solid fa-hammer"></i> Open Morelord Craftworks - Craft';
    const craftNotice = document.createElement("p");
    craftNotice.className = "journey-craft-notice";
    craftNotice.textContent = "Tell the assigned player to open Morelord Craftworks and perform a Craft action.";
    const syncCraft = () => {
      const selected = Array.from(panel.querySelectorAll("select[name^='watchAction']")).some(select => select.value === "Craft");
      craft.hidden = !selected;
      craftNotice.hidden = !selected;
    };
    panel.querySelectorAll("select[name^='watchAction']").forEach(select => select.addEventListener("change", syncCraft));
    syncCraft();
    const cook = document.createElement("div");
    cook.className = "journey-cook-resolution";
    const travelers = Array.from(panel.querySelector("select[name^='watchMember']")?.options ?? []).filter(option => option.value);
    const options = `<option value="">No recipient</option>${travelers.map(option => `<option value="${option.value}">${foundry.utils.escapeHTML(option.textContent)}</option>`).join("")}`;
    cook.innerHTML = `<p>After verbally resolving a successful Cook action, select up to two recipients.</p><select name="cookRecipient1">${options}</select><select name="cookRecipient2">${options}</select><button type="button" data-action="resolveCookSuccess">Record Successful Cooking (-1 Exhaustion each)</button>`;
    const syncCook = () => { cook.hidden = !Array.from(panel.querySelectorAll("select[name^='watchAction']")).some(select => select.value === "Cook"); };
    panel.querySelectorAll("select[name^='watchAction']").forEach(select => select.addEventListener("change", syncCook));
    syncCook();
    panel.append(craftNotice, craft, cook);
  }

  #renderCampSleep(context) {
    if (!sleepAndShelterEnabled()) return;
    const anchor = this.element.querySelector(".journey-phase-card > [data-action='advancePhase']");
    if (!anchor) return;
    const section = document.createElement("section");
    section.className = "journey-camp-sleep";
    const night = context.journey.currentDay?.nightEncounterCheck;
    const nightLabel = { peacefulRest: "Peaceful Rest", uneventful: "Uneventful Night", minor: "Minor Encounter", nightAttack: "Night Attack" }[night?.outcome] ?? "Night result unavailable";
    section.dataset.cold = String(Boolean(context.journey.currentDay?.phases?.weather?.cold));
    section.innerHTML = `<div class="journey-sleep-intro"><p>Weather and temperature are applied automatically from the Weather phase. Each traveler may select only sleeping equipment in their own inventory.</p><button type="button" class="journey-help-button" data-sleep-help aria-label="Explain sleep and interruption outcomes" data-tooltip="Explain sleep and interruption outcomes"><i class="fa-solid fa-circle-question"></i></button></div><div class="journey-night-confirmation"><small>Night encounter result</small><strong>${nightLabel}</strong><span>${night?.pendingSleepConfirmation ? "Pending confirmation with the sleep results" : "Confirmed"}</span></div><div class="journey-camp-sleep-list"></div>`;
    section.querySelector("[data-sleep-help]").addEventListener("click", event => {
      event.preventDefault();
      void foundry.applications.api.DialogV2.prompt({ window: { title: "Sleep, Interruptions, and Long Rests", icon: "fa-solid fa-circle-question" }, content: "<div class='ml-journeys-help-content'><p>Sleep starts at 8 hours, minus 2 hours for every watch the character takes. A Long Rest requires a successful Constitution sleep check, at least 6 hours of sleep, and less than 1 interrupted hour. A Night Attack prefills 1 combat-interruption hour; adjust that value to the actual interruption before rolling. A Peaceful Rest result reduces the sleep DC by 5. Missing the Long Rest triggers the escalating sleep-deprivation save unless that setting is disabled. Food or water shortages prevent Exhaustion recovery.</p></div>", ok: { label: "Close" } });
    });
    const list = section.querySelector(".journey-camp-sleep-list");
      for (const traveler of context.journey.travelers) {
        const owned = Object.fromEntries(["tent", "bedroll", "blanket"].map(gear => [gear, (context.journey.supplies?.items ?? []).some(item => item.sourceActorUuid === traveler.actorUuid && item.sourceType !== "group" && item.category === gear && item.availableQuantity > 0)]));
        const options = shelterOptions(owned).map(entry => `<option value="${entry.value}">${entry.label}</option>`).join("");
        const row = document.createElement("div");
        row.className = "journey-camp-sleep-row";
        row.dataset.actorUuid = traveler.actorUuid;
        row.innerHTML = `<header class="journey-sleep-character"><strong>${foundry.utils.escapeHTML(traveler.name)}</strong><span class="journey-sleep-dc">Sleep DC 10</span></header><div class="journey-shelter-group"><span class="journey-control-label">Sleeping setup</span><div class="journey-shelter-choices"><select data-shelter-select aria-label="Sleeping setup for ${foundry.utils.escapeHTML(traveler.name)}">${options}</select><button type="button" class="journey-help-button" data-shelter-help aria-label="Explain shelter bonuses" data-tooltip="Explain shelter bonuses"><i class="fa-solid fa-circle-question"></i></button></div></div><div class="journey-sleep-time-fields"><label><span>Sleep hours</span><input type="number" data-sleep-hours min="0" max="8" step="0.5" value="8"></label><label><span>Interrupted hours</span><input type="number" data-interruption-hours min="0" max="8" step="0.25" value="0"></label></div>`;
        row.querySelector("[data-shelter-help]").addEventListener("click", event => {
          event.preventDefault();
          void foundry.applications.api.DialogV2.prompt({ window: { title: "Shelter and Sleep DC", icon: "fa-solid fa-circle-question" }, content: "<div class='ml-journeys-help-content'><ul><li>Owned tent: -5 DC</li><li>Owned bedroll: -2 DC</li><li>Owned blanket in cold weather: -1 DC</li><li>Extreme weather: +5 DC</li><li>Peaceful night: -5 DC</li></ul><p>Sleeping equipment is never pooled.</p></div>", ok: { label: "Close" } });
        });
        list.append(row);
    }
    const recalculate = () => {
      const cold = section.dataset.cold === "true";
      for (const row of list.children) {
        const equipment = selectedShelter(row);
        let dc = 10;
        if (equipment.tent) dc -= 5;
        if (equipment.bedroll) dc -= 2;
        if (cold && equipment.blanket) dc -= 1;
        const extreme = Boolean(row.closest(".journey-camp-sleep")?.dataset.extreme === "true");
        if (extreme) dc += 5;
        if (row.closest(".journey-camp-sleep")?.dataset.peaceful === "true") dc -= 5;
        row.querySelector(".journey-sleep-dc").textContent = `Sleep DC ${Math.max(0, dc)}`;
      }
    };
    section.querySelectorAll("input, select").forEach(input => input.addEventListener("change", recalculate));
    const roll = document.createElement("button");
    roll.type = "button";
    roll.dataset.action = "rollCampSleep";
    roll.textContent = "Roll Party Sleep Checks";
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
        const watchesTaken = (active.currentDay?.campWatches ?? []).filter(watch => watch.actorUuid === entry.actorUuid && watch.action === "Take a Watch").length;
        row.querySelector("[data-sleep-hours]").value = entry.sleepHours ?? Math.max(0, 8 - watchesTaken * 2);
        const encounterHours = (active.currentDay?.sleepInterruptions ?? [])
          .filter(item => item.actorUuid === entry.actorUuid)
          .reduce((total, item) => total + Math.max(0, Number(item.hours ?? Number(item.minutes ?? 0) / 60)), 0);
        const savedInterruptionHours = entry.interruptionHours ?? Number(entry.interruptionMinutes ?? 0) / 60;
        row.querySelector("[data-interruption-hours]").value = Math.max(Number(savedInterruptionHours), encounterHours);
      }
      recalculate();
      if (active.currentDay?.campSleepResults?.length) {
        const summary = document.createElement("div");
        summary.className = "journey-sleep-results";
        summary.innerHTML = `<h4>Sleep Check Results</h4><div class="journey-sleep-result-list">${active.currentDay.campSleepResults.map(result => `<article class="journey-sleep-result ${result.longRestCompleted ? "is-success" : "is-failure"}"><header><strong>${foundry.utils.escapeHTML(result.actorName)}</strong><span>${result.longRestCompleted ? "Long Rest completed" : "No Long Rest"}</span></header><p class="journey-result-consequence">${foundry.utils.escapeHTML(result.consequence)}</p></article>`).join("")}</div>`;
        summary.append(createOutcomeDetails({ cards: active.currentDay.campSleepResults.map(result => ({ title: result.actorName, rows: [
          { label: "Sleep check roll", value: result.total },
          { label: "Base DC", value: result.baseDC },
          ...(result.modifiers ?? []).map(modifier => ({ label: SLEEP_MODIFIER_LABELS[modifier.id] ?? modifier.id, value: `${modifier.value >= 0 ? "+" : ""}${modifier.value}` })),
          { label: "Final DC", value: result.dc },
          { label: "Check outcome", value: result.succeeded ? "Success" : "Failure" },
          { label: "Sleep", value: `${result.sleepHours ?? 0} hours` },
          { label: "Interrupted", value: `${result.interruptionHours ?? Number(result.interruptionMinutes ?? 0) / 60} hours` },
          { label: "Long Rest", value: result.longRestCompleted ? "Completed" : "Not completed" },
          { label: "Exhaustion change", value: result.exhaustionChange > 0 ? `+${result.exhaustionChange}` : result.exhaustionChange }
        ] })) }));
        section.append(summary);
      }
      const eligible = active.currentDay?.peacefulRestEligible ?? [];
      if (eligible.length) {
        const choices = document.createElement("div");
        choices.className = "journey-peaceful-rest";
        choices.innerHTML = `<h4>Peaceful Rest Benefits</h4><p>Players choose these benefits. Journeys records the selections but does not apply them mechanically.</p><div class="journey-peaceful-choice-list">${eligible.map(actorUuid => { const traveler = active.travelers.find(item => item.actorUuid === actorUuid); const choice = active.currentDay?.peacefulRestChoices?.find(item => item.actorUuid === actorUuid); const pending = active.currentDay?.pendingPeacefulRestChoices?.find(item => item.actorUuid === actorUuid); return `<article data-peaceful-actor="${actorUuid}"><strong>${foundry.utils.escapeHTML(traveler?.name ?? "Traveler")}</strong>${choice ? `<span class="journey-peaceful-selection">${foundry.utils.escapeHTML(choice.label)}</span>` : pending ? `<div class="journey-peaceful-pending"><span>Awaiting player selection</span><select aria-label="Peaceful Rest benefit for ${foundry.utils.escapeHTML(traveler?.name ?? "Traveler")}"><option value="firstSaveAdvantage">Advantage on the first saving throw tomorrow</option><option value="exhaustion">Remove one additional level of Exhaustion</option><option value="inspiration">Gain Heroic Inspiration</option></select><div class="journey-inline-actions"><button type="button" data-action="resendPeacefulRest" data-request-id="${pending.id}">Resend</button><button type="button" data-action="setPeacefulRest" data-request-id="${pending.id}">GM Set</button></div></div>` : `<span>Selection not requested</span>`}</article>`; }).join("")}</div>`;
        section.append(choices);
      }
    });
  }

  #renderForaging(context) {
    const notes = this.element.querySelector(".journey-phase-card > [data-action='advancePhase']");
    if (!notes) return;
    const craftworks = this.element.querySelector(".journey-craftworks-integration");
    if (craftworks) {
      craftworks.querySelector("strong").textContent = "Optional: Gather crafting materials";
      craftworks.querySelector("p").textContent = context.craftworksGather.available
        ? "After resolving food and water, optionally open Craftworks Gather to search for crafting materials. Gather does not replace foraging."
        : "Craftworks is unavailable. Food and water foraging still resolves normally in Journeys.";
      const button = craftworks.querySelector("[data-action='openCraftworksGather']");
      if (button) {
        button.textContent = "Open Morelord Craftworks - Gather";
        button.classList.add("journey-emphasis-button");
      }
    }

    const saved = context.journey.currentDay?.foragingResolution;
    const panel = document.createElement("section");
    panel.className = "ml-journeys-panel journey-card journey-foraging-check";
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
      status.className = `journey-forager-status ${result?.succeeded ? "success" : result ? "failure" : ""}`;
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
      summary.innerHTML = `<strong>Supplies required today:</strong> ${saved.foodRequired} ration(s), ${saved.waterRequired} pint(s) of water.${saved.waterSourceFound ? " A forager found water for everyone; carried water is not consumed and containers may be refilled." : ""}<br><small>Expedition pool: ${context.journey.supplies?.totals?.food ?? 0} food, ${context.journey.supplies?.totals?.water ?? 0} water pints.</small>`;
      panel.append(summary);
      if (!pending.length && results.length >= context.journey.travelers.length && !context.journey.currentDay?.supplyResolution) {
        this.#renderSupplyAllocation(panel, context, saved);
      }
      if (context.journey.currentDay?.supplyResolution) {
        const resolution = document.createElement("div");
        resolution.className = "journey-foraging-summary";
        const applied = context.journey.currentDay.supplyResolution;
        resolution.innerHTML = `<strong>Supplies resolved.</strong> Remaining shortages: ${applied.shortages.food} food, ${applied.shortages.water} water.`;
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
    const plan = supplyConsumption.planForTravelers(context.journey.supplies, {
      travelers: context.journey.travelers,
      foodActorUuids: requirements.failedActorUuids,
      waterActorUuids
    });
    const section = document.createElement("div");
    section.className = "journey-supply-allocation";
    const heading = document.createElement("h4");
    heading.textContent = "Allocate Daily Supplies";
    const explanation = document.createElement("p");
    explanation.textContent = "Food and water are pooled across traveler and Group inventories. Review every source before confirming consumption.";
    section.append(heading, explanation);
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
    section.append(apply);
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

  static async openCraftworksCraft(event) {
    event.preventDefault();
    try {
      const module = game.modules.get("morelord-craftworks");
      const api = module?.active ? module.api ?? globalThis.MorelordCraftworks : null;
      if (!api?.openCraft) throw new Error("Morelord Craftworks Craft is not available.");
      await api.openCraft();
    } catch (error) { ui.notifications.error(error.message); }
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
        foodActorUuids: requirements.failedActorUuids,
        waterActorUuids: requirements.successfulActorUuids.length ? [] : journey.travelers.map(traveler => traveler.actorUuid)
      });
      const manualFood = new Set(Array.from(this.element.querySelectorAll("[data-manual-food]:checked"), input => input.dataset.manualFood));
      const manualWater = new Set(Array.from(this.element.querySelectorAll("[data-manual-water]:checked"), input => input.dataset.manualWater));
      plan.shortageActorUuids.food = plan.shortageActorUuids.food.filter(uuid => !manualFood.has(uuid));
      plan.shortageActorUuids.water = plan.shortageActorUuids.water.filter(uuid => !manualWater.has(uuid));
      plan.shortages.food = plan.shortageActorUuids.food.length;
      plan.shortages.water = plan.shortageActorUuids.water.length;
      plan.manual = { foodActorUuids: [...manualFood], waterActorUuids: [...manualWater] };
      await supplyConsumption.apply(plan);
      if (requirements.waterSourceFound) {
        plan.refilledWaterContainers = await supplyManifest.refillTravelerContainers(journey.travelers.map(traveler => traveler.actorUuid));
      }
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
        peacefulNight: journey.currentDay?.nightEncounterCheck?.outcome === "peacefulRest"
      });
      for (const entry of journey.currentDay.campSleepPlan.entries) {
        const row = this.element.querySelector(`.journey-camp-sleep-row[data-actor-uuid='${entry.actorUuid}']`);
        entry.sleepHours = Number(row?.querySelector("[data-sleep-hours]")?.value ?? 8);
        entry.interruptionHours = Number(row?.querySelector("[data-interruption-hours]")?.value ?? 0);
      }
      await saveActiveJourney(journey);
      ui.notifications.info("Camp sleep plan saved.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async rollCampSleep(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      const assignments = {};
      for (const row of this.element.querySelectorAll(".journey-camp-sleep-row")) assignments[row.dataset.actorUuid] = selectedShelter(row);
      const plan = campSupplies.buildSleepPlan({ travelers: journey.travelers, supplies: journey.supplies, assignments, extremeWeather: Boolean(journey.currentDay.phases?.weather?.extreme), coldWeather: Boolean(journey.currentDay.phases?.weather?.cold), peacefulNight: journey.currentDay?.nightEncounterCheck?.outcome === "peacefulRest" });
      for (const entry of plan.entries) {
        const row = this.element.querySelector(`.journey-camp-sleep-row[data-actor-uuid='${entry.actorUuid}']`);
        entry.sleepHours = Number(row?.querySelector("[data-sleep-hours]")?.value ?? 8);
        entry.interruptionHours = Number(row?.querySelector("[data-interruption-hours]")?.value ?? 0);
      }
      journey.currentDay.campSleepPlan = plan;
      journey.campDefaults ??= {};
      journey.campDefaults.sleepPlan = structuredClone(plan);
      const consequences = journey.currentDay?.supplyConsequences ?? { foodActorUuids: [], waterActorUuids: [] };
      const results = [];
      for (const entry of plan.entries) {
        const actor = await fromUuid(entry.actorUuid);
        if (!actor) continue;
        const sleep = await rollConstitutionSave(actor, { dc: entry.dc, title: `${actor.name} — Camp sleep save DC ${entry.dc}`, advantage: journey.currentDay?.pace === "stopped" });
        if (!sleep) continue;
        const { roll, total } = sleep;
        const succeeded = total >= entry.dc;
        const longRestCompleted = qualifiesForLongRest({ sleepCheckSucceeded: succeeded, sleepHours: entry.sleepHours, interruptionHours: entry.interruptionHours });
        const current = Number(actor.system?.attributes?.exhaustion ?? 0);
        const wasFedAndWatered = !consequences.foodActorUuids.includes(entry.actorUuid) && !consequences.waterActorUuids.includes(entry.actorUuid);
        let change = longRestCompleted && wasFedAndWatered ? -1 : 0;
        let daysWithoutLongRest = Number(actor.getFlag(MODULE_ID, "daysWithoutLongRest") ?? 0);
        let deprivation = null;
        if (longRestCompleted) {
          daysWithoutLongRest = 0;
          await actor.setFlag(MODULE_ID, "daysWithoutLongRest", 0);
        } else {
          daysWithoutLongRest += 1;
          await actor.setFlag(MODULE_ID, "daysWithoutLongRest", daysWithoutLongRest);
          if (!suppressSleepDeprivationExhaustion()) {
            const dc = sleepDeprivationDC(daysWithoutLongRest);
            const deprivationRoll = await rollConstitutionSave(actor, { dc, title: `${actor.name} — Sleep deprivation save DC ${dc}` });
            if (!deprivationRoll) throw new Error(`${actor.name}'s sleep-deprivation save was cancelled.`);
            const deprivationSucceeded = deprivationRoll.total >= dc;
            if (!deprivationSucceeded) change += 1;
            deprivation = { dc, total: deprivationRoll.total, succeeded: deprivationSucceeded };
          } else deprivation = { suppressed: true };
        }
        if (change) await actor.update({ "system.attributes.exhaustion": Math.max(0, current + change) });
        const consequence = longRestCompleted
          ? wasFedAndWatered ? "completed a Long Rest; Exhaustion reduced by 1" : "completed a Long Rest, but food or water shortage prevents Exhaustion recovery"
          : deprivation?.suppressed ? "did not complete a Long Rest; no Long Rest benefits and sleep-deprivation Exhaustion is disabled"
            : deprivation?.succeeded ? "did not complete a Long Rest; passed the sleep-deprivation save"
              : "did not complete a Long Rest; failed the sleep-deprivation save and gained 1 Exhaustion";
        results.push({ actorUuid: actor.uuid, actorName: actor.name, baseDC: entry.baseDC, modifiers: entry.modifiers, dc: entry.dc, total, advantage: journey.currentDay?.pace === "stopped", sleepHours: entry.sleepHours, interruptionHours: entry.interruptionHours, longRestCompleted, daysWithoutLongRest, deprivation, fed: !consequences.foodActorUuids.includes(entry.actorUuid), watered: !consequences.waterActorUuids.includes(entry.actorUuid), succeeded, exhaustionChange: change, consequence });
      }
      journey.currentDay.campSleepResults = results;
      const peacefulNight = journey.currentDay?.nightEncounterCheck?.outcome === "peacefulRest";
      const slumberActors = (journey.currentDay?.campWatches ?? []).filter(watch => watch.action === "Slumber").map(watch => watch.actorUuid);
      const watchActors = new Set((journey.currentDay?.campWatches ?? []).filter(watch => watch.action === "Take a Watch").map(watch => watch.actorUuid));
      const automaticSlumberActors = journey.travelers.filter(traveler => !watchActors.has(traveler.actorUuid)).map(traveler => traveler.actorUuid);
      journey.currentDay.peacefulRestEligible = [...new Set([...(peacefulNight ? results.filter(result => result.longRestCompleted).map(result => result.actorUuid) : []), ...slumberActors, ...automaticSlumberActors].filter(actorUuid => results.some(result => result.actorUuid === actorUuid && result.longRestCompleted)))];
      if (journey.currentDay.nightEncounterCheck) {
        journey.currentDay.nightEncounterCheck.pendingSleepConfirmation = false;
        journey.currentDay.nightEncounterCheck.sleepConfirmedAt = Date.now();
      }
      await saveActiveJourney(journey);
      if (journey.currentDay.peacefulRestEligible.length) await peacefulRestService.requestEligible();
      ui.notifications.info("Camp sleep checks resolved.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
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
        const current = Number(actor.system?.attributes?.exhaustion ?? 0);
        await actor.update({ "system.attributes.exhaustion": Math.max(0, current - 1) });
        recipients.push({ actorUuid, actorName: actor.name, exhaustionChange: current > 0 ? -1 : 0 });
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
