import { getEncounterDie } from "../core/journey-settings.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { foragingRollService } from "../services/foraging-roll-service.mjs";
import { SupplyConsumptionService } from "../services/supply-consumption-service.mjs";
import { SupplyManifestService } from "../services/supply-manifest-service.mjs";
import { supplyConsequenceService } from "../services/supply-consequence-service.mjs";
import { CampSupplyService } from "../services/camp-supply-service.mjs";
import { JourneyFinalApplication as BaseJourneyApplication } from "./journey-final-app.mjs";

const CAMP_ACTION_HELP = Object.freeze({
  "Take a Watch": "Remain alert during this watch and make any required Perception checks normally.",
  Craft: "Make 2 hours of crafting progress. Requires the related tools and usually a campfire; Perception checks are at disadvantage.",
  Cook: "Use cook's utensils to prepare a hearty meal and improve Hit Die recovery. Requires a campfire; Perception checks are at disadvantage.",
  Prepare: "Prepare one ability and gain a d6 Preparation die that decreases after each use until depleted.",
  Slumber: "Sleep the full 8 hours, automatically fail Perception checks, reduce Exhaustion by 2, and awaken with Inspiration.",
  Task: "Replace the Camp Action with 2 hours of progress on another suitable task; Perception checks are usually at disadvantage."
});
const supplyConsumption = new SupplyConsumptionService();
const supplyManifest = new SupplyManifestService();
const campSupplies = new CampSupplyService();

export class JourneyForagingApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = { actions: {
    requestForagingRolls: this.requestForagingRolls,
    autoForagingSuccess: this.autoForagingSuccess,
    autoForagingFailure: this.autoForagingFailure,
    openCraftworksCraft: this.openCraftworksCraft,
    rollCampWatch: this.rollCampWatch,
    consumeTravelSupplies: this.consumeTravelSupplies,
    resolveSupplyConsequences: this.resolveSupplyConsequences,
    autoSupplySaveSuccess: this.autoSupplySaveSuccess,
    autoSupplySaveFailure: this.autoSupplySaveFailure,
    saveCampSleepPlan: this.saveCampSleepPlan,
    rollCampSleep: this.rollCampSleep,
    setWaterState: this.setWaterState
  } };

  #foragingUpdated = () => { if (this.rendered) void this.render({ force: true }); };
  #supplyUpdated = () => { if (this.rendered) void this.render({ force: true }); };

  constructor(options = {}) {
    super(options);
    foragingRollService.addEventListener("updated", this.#foragingUpdated);
    supplyConsequenceService.addEventListener("updated", this.#supplyUpdated);
  }

  async close(options = {}) {
    foragingRollService.removeEventListener("updated", this.#foragingUpdated);
    supplyConsequenceService.removeEventListener("updated", this.#supplyUpdated);
    return super.close(options);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (context.phaseIs?.foraging) this.#renderForaging(context);
    if (context.phaseIs?.camp) {
      this.#enhanceCampActions();
      this.#enableAssignedWatches();
    }
  }

  #enableAssignedWatches() {
    this.element.querySelector("[data-action='saveCampPlan']")?.remove();
    for (const row of this.element.querySelectorAll(".journey-watch-row")) {
      const member = row.querySelector("select[name^='watchMember']");
      const roll = row.querySelector("[data-action='rollCampWatch']");
      if (!member || !roll) continue;
      const synchronize = () => {
        roll.disabled = !member.value;
        roll.dataset.tooltip = member.value ? "Roll this watch using the current assignments." : "Assign a traveler to enable this watch roll.";
      };
      for (const select of row.querySelectorAll("select")) select.addEventListener("change", synchronize);
      synchronize();
    }
  }

  #enhanceCampActions() {
    const panel = this.element.querySelector(".journey-camp-planner");
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
    const craft = document.createElement("button");
    craft.type = "button";
    craft.dataset.action = "openCraftworksCraft";
    craft.innerHTML = '<i class="fa-solid fa-hammer"></i> Open Craftworks Craft';
    panel.append(craft);
    this.#renderCampSleep(panel);
  }

  #renderCampSleep(panel) {
    const section = document.createElement("section");
    section.className = "journey-camp-sleep";
    section.innerHTML = `<h3>Sleep & Shelter</h3><p>Assign shelter from the current manifest. A tent supports two travelers; bedrolls and blankets support one each.</p><label class="journey-check"><input type="checkbox" name="campColdWeather"><span>Cold weather (blankets reduce sleep DC)</span></label><div class="journey-camp-sleep-list"></div>`;
    const list = section.querySelector(".journey-camp-sleep-list");
    const travelerRows = this.element.querySelectorAll(".journey-watch-row select[name^='watchMember']");
    const seen = new Set();
    for (const select of travelerRows) {
      for (const option of select.options) {
        if (!option.value || seen.has(option.value)) continue;
        seen.add(option.value);
        const row = document.createElement("div");
        row.className = "journey-camp-sleep-row";
        row.dataset.actorUuid = option.value;
        row.innerHTML = `<strong>${foundry.utils.escapeHTML(option.textContent)}</strong><label><input type="checkbox" data-gear="tent"> Tent</label><label><input type="checkbox" data-gear="bedroll"> Bedroll</label><label><input type="checkbox" data-gear="blanket"> Blanket</label><span class="journey-sleep-dc">DC 10</span>`;
        list.append(row);
      }
    }
    const recalculate = () => {
      const cold = section.querySelector("[name='campColdWeather']").checked;
      for (const row of list.children) {
        let dc = 10;
        if (row.querySelector("[data-gear='tent']").checked) dc -= 5;
        if (row.querySelector("[data-gear='bedroll']").checked) dc -= 2;
        if (cold && row.querySelector("[data-gear='blanket']").checked) dc -= 1;
        row.querySelector(".journey-sleep-dc").textContent = `DC ${Math.max(0, dc)} + weather`;
      }
    };
    section.querySelectorAll("input").forEach(input => input.addEventListener("change", recalculate));
    const save = document.createElement("button");
    save.type = "button";
    save.dataset.action = "saveCampSleepPlan";
    save.innerHTML = '<i class="fa-solid fa-bed"></i> Save Sleep Plan';
    const roll = document.createElement("button");
    roll.type = "button";
    roll.dataset.action = "rollCampSleep";
    roll.innerHTML = '<i class="fa-solid fa-dice-d20"></i> Roll Party Sleep Checks';
    section.append(save, roll);
    panel.append(section);
    recalculate();
    void getActiveJourney().then(active => {
      const saved = active?.currentDay?.campSleepPlan;
      if (!saved || !this.rendered) return;
      section.querySelector("[name='campColdWeather']").checked = saved.coldWeather;
      for (const entry of saved.entries) {
        const row = section.querySelector(`[data-actor-uuid='${entry.actorUuid}']`);
        if (!row) continue;
        for (const gear of ["tent", "bedroll", "blanket"]) row.querySelector(`[data-gear='${gear}']`).checked = entry.equipment[gear];
      }
      recalculate();
    });
  }

  #renderForaging(context) {
    const notes = this.element.querySelector("[name='foragingNotes']")?.closest("label");
    if (!notes) return;
    const craftworks = this.element.querySelector(".journey-craftworks-integration");
    if (craftworks) {
      craftworks.querySelector("strong").textContent = "Optional: Gather crafting materials";
      craftworks.querySelector("p").textContent = context.craftworksGather.available
        ? "After resolving food and water, optionally open Craftworks Gather to search for crafting materials. Gather does not replace foraging."
        : "Craftworks is unavailable. Food and water foraging still resolves normally in Journeys.";
      const button = craftworks.querySelector("[data-action='openCraftworksGather']");
      if (button) button.textContent = "Gather Crafting Materials";
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
      const name = document.createElement("span");
      name.textContent = traveler.name;
      const request = pending.find(candidate => candidate.actorUuid === traveler.actorUuid);
      const result = results.find(candidate => candidate.actorUuid === traveler.actorUuid);
      const status = document.createElement("span");
      status.className = `journey-forager-status ${result?.succeeded ? "success" : result ? "failure" : ""}`;
      status.textContent = request ? "Pending" : result ? `${result.succeeded ? "Success" : "Failure"}${result.automatic ? " · GM" : ` · ${result.total}`}` : "Not requested";
      row.append(image, name, status);
      if (request) {
        for (const [action, label] of [["autoForagingFailure", "Fail"], ["autoForagingSuccess", "Succeed"]]) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.action = action;
          button.dataset.requestId = request.id;
          button.textContent = label;
          row.append(button);
        }
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
      summary.innerHTML = `<strong>Supplies required today:</strong> ${saved.foodRequired} food, ${saved.waterRequired} water.<br><small>Manifest available: ${context.journey.supplies?.totals?.food ?? 0} food, ${context.journey.supplies?.totals?.water ?? 0} water.</small>`;
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
      const resolve = document.createElement("button");
      resolve.type = "button";
      resolve.dataset.action = "resolveSupplyConsequences";
      resolve.innerHTML = '<i class="fa-solid fa-heart-pulse"></i> Resolve Shortage Consequences';
      panel.append(resolve);
      return;
    }
    const section = document.createElement("div");
    section.className = "journey-supply-allocation";
    section.innerHTML = `<h4>Supply Consequences</h4><p>${consequences.waterActorUuids.length} traveler(s) lacked water and gained Exhaustion automatically.</p>`;
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
    explanation.textContent = "Each failed traveler uses their own supplies first, then shared Group inventory. Supplies are never taken from another traveler.";
    section.append(heading, explanation);
    plan.allocations.forEach((allocation, index) => {
      const row = document.createElement("div");
      row.className = "journey-supply-allocation-row";
      const text = document.createElement("span");
      const source = allocation.sourceType === "group" ? `${allocation.sourceActorName} (Group inventory)` : "their inventory";
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
      ? `Shortages remain for: ${[...new Set(shortNames)].join(", ")}.`
      : "Everyone who needs supplies is covered.";
    section.append(shortages);
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

  static async openCraftworksCraft(event) {
    event.preventDefault();
    try {
      const module = game.modules.get("morelord-craftworks");
      const api = module?.active ? module.api ?? globalThis.MorelordCraftworks : null;
      if (!api?.openCraft) throw new Error("Morelord Craftworks Craft is not available.");
      await api.openCraft();
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async rollCampWatch(event, target) {
    event.preventDefault();
    try {
      const index = Number(target.dataset.watchIndex);
      const journey = await getActiveJourney();
      const actorUuid = this.element.querySelector(`[name='watchMember${index}']`)?.value ?? "";
      if (!actorUuid) throw new Error("Assign a traveler before rolling this watch.");
      const traveler = journey.travelers.find(candidate => candidate.actorUuid === actorUuid);
      const action = this.element.querySelector(`[name='watchAction${index}']`)?.value ?? "Take a Watch";
      let campActionEffect = null;
      if (action === "Cook") {
        const cook = await fromUuid(actorUuid);
        const utensils = Array.from(cook?.items ?? []).find(item => /cook(?:'|’)?s utensils/i.test(item.name));
        if (!utensils) throw new Error(`${traveler?.name ?? "The assigned traveler"} needs cook's utensils to Cook.`);
        journey.supplies = await supplyManifest.build({
          travelerUuids: journey.travelers.map(candidate => candidate.actorUuid),
          partyActorUuid: journey.partyActorUuid
        });
        const meal = supplyConsumption.plan(journey.supplies, { food: 1, water: 0 });
        if (meal.shortages.food) throw new Error("The party has no usable food remaining for Cook.");
        await supplyConsumption.apply(meal);
        journey.supplies = await supplyManifest.build({
          travelerUuids: journey.travelers.map(candidate => candidate.actorUuid),
          partyActorUuid: journey.partyActorUuid
        });
        const proficient = Number(utensils.system?.proficient ?? utensils.system?.proficiency ?? 0) > 0;
        campActionEffect = {
          type: "cook",
          foodConsumed: 1,
          hitDiceRecovered: proficient ? Number(cook.system?.attributes?.prof ?? 1) : 1,
          proficient,
          recordedAt: Date.now()
        };
      }
      journey.currentDay.campWatches ??= [];
      journey.currentDay.campWatches[index] = {
        ...(journey.currentDay.campWatches[index] ?? {}),
        index,
        actorUuid,
        actorName: traveler?.name ?? "Unknown traveler",
        action,
        campActionEffect
      };

      const danger = Number(journey.routeSnapshot.danger ?? 0);
      const die = getEncounterDie();
      const maximum = Number(die.replace(/^d/, ""));
      const roll = danger ? await new Roll(`${danger}${die}`).evaluate() : null;
      const results = roll ? roll.dice.flatMap(term => term.results.filter(result => result.active !== false).map(result => result.result)) : [];
      const encounterCount = results.filter(result => result === 1).length;
      const boonCount = results.filter(result => result === maximum).length;
      journey.currentDay.campWatches[index].encounterRoll = { die, danger, results, encounterCount, boonCount, rolledAt: Date.now() };
      await saveActiveJourney(journey);
      if (roll) await roll.toMessage({ flavor: `Morelord Journeys — Watch ${index + 1} · ${encounterCount} complications, ${boonCount} boons` });
      await ChatMessage.create({
        speaker: { alias: "Morelord Journeys" },
        content: `<article class="ml-chat-card ml-journeys-chat-card"><header><i class="fa-solid fa-moon"></i><strong>Watch ${index + 1} Complete</strong></header><p>${encounterCount} complication${encounterCount === 1 ? "" : "s"} and ${boonCount} boon${boonCount === 1 ? "" : "s"} during ${foundry.utils.escapeHTML(traveler?.name ?? "the traveler's")} watch (${foundry.utils.escapeHTML(action)}).</p></article>`
      });
      await this.render({ force: true });
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
      await supplyConsumption.apply(plan);
      journey.currentDay.supplyResolution = { ...plan, resolvedAt: Date.now() };
      journey.supplies = await supplyManifest.build({
        travelerUuids: journey.travelers.map(traveler => traveler.actorUuid),
        partyActorUuid: journey.partyActorUuid
      });
      await saveActiveJourney(journey);
      ui.notifications.info("Daily food and water consumption applied to inventories.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async resolveSupplyConsequences(event) {
    event.preventDefault();
    try { await supplyConsequenceService.begin(); await this.render({ force: true }); }
    catch (error) { ui.notifications.error(error.message); }
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
        assignments[row.dataset.actorUuid] = Object.fromEntries(["tent", "bedroll", "blanket"].map(gear => [gear, row.querySelector(`[data-gear='${gear}']`).checked]));
      }
      journey.currentDay.campSleepPlan = campSupplies.buildSleepPlan({
        travelers: journey.travelers,
        supplies: journey.supplies,
        assignments,
        extremeWeather: Boolean(journey.currentDay.phases?.weather?.extreme),
        coldWeather: this.element.querySelector("[name='campColdWeather']")?.checked ?? false
      });
      await saveActiveJourney(journey);
      ui.notifications.info("Camp sleep plan saved.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async rollCampSleep(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      const plan = journey.currentDay?.campSleepPlan;
      if (!plan) throw new Error("Save the Camp sleep plan first.");
      const consequences = journey.currentDay?.supplyConsequences ?? { foodActorUuids: [], waterActorUuids: [] };
      const results = [];
      for (const entry of plan.entries) {
        const actor = await fromUuid(entry.actorUuid);
        if (!actor) continue;
        const modifier = Number(actor.system?.abilities?.con?.save?.value ?? actor.system?.abilities?.con?.save ?? 0);
        const roll = await new Roll("1d20 + @modifier", { modifier }).evaluate();
        const succeeded = roll.total >= entry.dc;
        const current = Number(actor.system?.attributes?.exhaustion ?? 0);
        const wasFedAndWatered = !consequences.foodActorUuids.includes(entry.actorUuid) && !consequences.waterActorUuids.includes(entry.actorUuid);
        const change = succeeded && wasFedAndWatered ? -1 : succeeded ? 0 : 1;
        if (change) await actor.update({ "system.attributes.exhaustion": Math.max(0, current + change) });
        await roll.toMessage({ flavor: `${actor.name} — Camp sleep save DC ${entry.dc}` });
        results.push({ actorUuid: actor.uuid, actorName: actor.name, dc: entry.dc, total: roll.total, succeeded, exhaustionChange: change });
      }
      journey.currentDay.campSleepResults = results;
      await saveActiveJourney(journey);
      ui.notifications.info("Camp sleep checks resolved.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async setWaterState(event, target) {
    event.preventDefault();
    try {
      const item = await fromUuid(target.dataset.itemUuid);
      if (!item) throw new Error("That water container could not be found.");
      const full = target.dataset.waterState === "full";
      await item.update({
      "flags.morelord-journeys.waterState": full ? "full" : "empty",
      "flags.morelord-journeys.waterUnits": full ? Math.max(0, Number(item.system?.quantity ?? 1)) : 0
      });
      const journey = await getActiveJourney();
      journey.supplies = await supplyManifest.build({ travelerUuids: journey.travelers.map(traveler => traveler.actorUuid), partyActorUuid: journey.partyActorUuid });
      await saveActiveJourney(journey);
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }
}
