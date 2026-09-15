import { preparePlannerSections } from "../ui/planner-sections.mjs";
import { actorIdentity } from "../../../morelord-core/scripts/ui/actor-identity.js";
import { applyPlannerDefaults, readPlannerDefaults } from "../ui/journey-planner-defaults.mjs";
import { getJourneyStepDefaults, JOURNEY_PLANNER_DEFAULTS_SETTING, readJourneySteps } from "../core/journey-settings.mjs";
import { MODULE_ID } from "../domain/constants.mjs";
import { Dnd5eJourneyAdapter } from "../adapters/dnd5e-journey-adapter.mjs";
import { readyJourney } from "../domain/engine.mjs";
import { createJourney } from "../domain/journey.mjs";
import { createRoute } from "../domain/route.mjs";
import { validateExpeditionRoles } from "../domain/expedition-role-rules.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { SupplyManifestService } from "../services/supply-manifest-service.mjs";
import { JourneyApplication as BaseJourneyApplication } from "./journey-dashboard-app.mjs";
import { bindExclusiveRoleSelects, synchronizeExclusiveRoleSelects } from "../ui/exclusive-role-controls.mjs";

const dnd5e = new Dnd5eJourneyAdapter();
const supplies = new SupplyManifestService();
const value = (element, name) => element.querySelector(`[name="${name}"]`)?.value ?? "";
const integer = (element, name, fallback = 0) => {
  const parsed = Number.parseInt(value(element, name), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

function option(select, { value: optionValue, label, selected = false }) {
  const entry = document.createElement("option");
  entry.value = optionValue;
  entry.textContent = label;
  entry.selected = selected;
  select.append(entry);
}

function selectField(name, label) {
  const field = document.createElement("label");
  const text = document.createElement("span");
  text.textContent = label;
  const select = document.createElement("select");
  select.name = name;
  field.append(text, select);
  return { field, select };
}

export class JourneyExpeditionApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = {
    actions: {
      createJourney: this.createJourney,
      refreshSupplies: this.refreshSupplies,
      saveJourneyDefaults: this.saveJourneyDefaults
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (context.journey) {
      context.observer = context.journey.travelers.find(
        traveler => traveler.actorUuid === context.journey.roles?.observerUuid
      ) ?? null;
      context.quartermaster = context.journey.travelers.find(
        traveler => traveler.actorUuid === context.journey.roles?.quartermasterUuid
      ) ?? null;
      if (!context.quartermaster && context.journey.roles?.quartermasterUuid === context.journey.partyActorUuid) {
        context.quartermaster = {
          actorUuid: context.journey.partyActorUuid,
          name: context.journey.supplies?.sources?.find(source => source.sourceType === "group")?.actorName ?? "Party"
        };
      }
    }
    const labels = { weather: "Weather", pace: "Pace", encounters: "Day Encounters", discovery: "Discoveries", navigation: "Navigation", pressOn: "Press On", foraging: "Foraging & Supplies", camp: "Camp", nightEncounters: "Night Encounters", sleep: "Sleep & Shelter" };
    context.journeySteps = Object.entries(getJourneyStepDefaults()).map(([key, enabled]) => ({ key, enabled, label: labels[key] }));
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!context.hasJourney) {
      this.#augmentPartyPlanner(context.availableTravelers);
      applyPlannerDefaults(this.element, game.settings.get(MODULE_ID, JOURNEY_PLANNER_DEFAULTS_SETTING) ?? {});
      await this.#renderPlannerSupplyManifest();
      this.element.querySelector(".ml-journeys-traveler-list")?.addEventListener("change", () => void this.#renderPlannerSupplyManifest());
    }
    else {
      this.#renderRoles(context);
      if (context.canBeginDay || context.phaseIs?.foraging) this.#renderSupplyManifest(context);
    }
  }

  #augmentPartyPlanner(travelers) {
    const planner = this.element.querySelector(".journey-party-planner");
    const navigatorField = planner?.querySelector("[name='navigatorUuid']")?.closest("label");
    const travelerList = planner?.querySelector(".ml-journeys-traveler-list");
    if (!planner || !navigatorField || !travelerList) return;

    const grid = document.createElement("div");
    grid.className = "ml-grid journey-role-grid";
    grid.dataset.columns = "2";
    const heading = document.createElement("h2");
    heading.textContent = "Expedition Roles";
    heading.className = "ml-section-heading";
    const section = document.createElement("section");
    section.className = "ml-stack journey-expedition-roles";
    const observer = selectField("observerUuid", "Observer");
    const quartermaster = selectField("quartermasterUuid", "Quartermaster");
    grid.append(navigatorField, observer.field, quartermaster.field);
    section.append(heading, grid);
    planner.append(section);
    const navigator = navigatorField.querySelector("select");

    const synchronize = () => {
      const selectedUuids = Array.from(travelerList.querySelectorAll("input:checked"), input => input.value);
      const selected = travelers.filter(traveler => selectedUuids.includes(traveler.uuid));
      const party = supplies.findPartyActor(selectedUuids);
      const priorObserver = observer.select.value;
      const priorQuartermaster = quartermaster.select.value;
      observer.select.replaceChildren();
      quartermaster.select.replaceChildren();
      for (const traveler of selected) {
        option(observer.select, { value: traveler.uuid, label: traveler.name, selected: traveler.uuid === priorObserver });
      }
      synchronizeExclusiveRoleSelects(navigator, observer.select);
      if (party) option(quartermaster.select, {
        value: party.uuid,
        label: `${party.name} (shared inventory)`,
        selected: !priorQuartermaster || party.uuid === priorQuartermaster
      });
      for (const traveler of selected) {
        option(quartermaster.select, {
          value: traveler.uuid,
          label: traveler.name,
          selected: traveler.uuid === priorQuartermaster
        });
      }
    };
    travelerList.addEventListener("change", synchronize);
    synchronize();
    bindExclusiveRoleSelects(navigator, observer.select);
  }

  #renderRoles(context) {
    const neededRole = context.phaseIs?.navigation ? "navigator" : context.phaseIs?.discovery ? "observer" : null;
    if (!neededRole) return;
    const headerAnchor = this.element.querySelector(".journey-progress-dashboard") ?? this.element.querySelector(".journey-dashboard-header");
    if (!headerAnchor) return;
    const panel = document.createElement("section");
    panel.className = "ml-surface ml-stack journey-roles-panel";
    const header = document.createElement("h2");
    header.textContent = "Expedition Roles";
    header.className = "ml-section-heading";
    const display = document.createElement("div");
    display.className = "ml-grid journey-role-display";
    display.dataset.columns = "3";
    const roleRows = ["navigator", "observer", "quartermaster"].map(role => {
      const actorUuid = context.journey.roles?.[`${role}Uuid`];
      const traveler = context.journey.travelers.find(candidate => candidate.actorUuid === actorUuid);
      const name = traveler?.name ?? (actorUuid === context.journey.partyActorUuid ? context.quartermaster?.name : null) ?? "Not assigned";
      return `<div class="ml-card ml-stack" data-gap="1"><span class="ml-eyebrow">${role[0].toUpperCase()}${role.slice(1)}</span><strong>${actorUuid ? actorIdentity({ ...traveler, actorUuid, name }) : foundry.utils.escapeHTML(name)}</strong></div>`;
    }).join("");
    display.innerHTML = roleRows;
    const hint = document.createElement("small");
    hint.textContent = "Expedition roles are assigned while planning the journey.";
    panel.append(header, display, hint);
    headerAnchor.after(panel);
  }

  async #renderPlannerSupplyManifest() {
    const travelerUuids = Array.from(this.element.querySelectorAll("[name='travelerUuid']:checked"), input => input.value);
    const partyActor = supplies.findPartyActor(travelerUuids);
    const manifest = await supplies.build({ travelerUuids, partyActorUuid: partyActor?.uuid ?? null });
    this.element.querySelector("[data-planner-supply-manifest]")?.remove();
    this.#renderSupplyManifest({ manifest }, { anchor: this.element.querySelector(".journey-expedition-roles") ?? this.element.querySelector(".journey-party-planner"), planner: true });
    if (this.element.querySelector("details.journey-party-planner")) preparePlannerSections(this.element);
  }

  #renderSupplyManifest(context, { anchor = null, planner = false } = {}) {
    const roles = anchor ?? this.element.querySelector(".journey-daily-ratings") ?? this.element.querySelector(".journey-roles-panel") ?? this.element.querySelector(".journey-phase-card") ?? this.element.querySelector(".ml-empty-state") ?? this.element.querySelector(".journey-dashboard-header");
    if (!roles) return;
    const manifest = context.manifest ?? context.journey?.supplies ?? {};
    const panel = document.createElement("section");
    panel.className = "ml-surface ml-stack journey-supply-panel";
    if (planner) { panel.dataset.plannerSupplyManifest = ""; panel.classList.add("journey-planner-supply-panel"); }
    const header = document.createElement("div");
    header.className = "ml-section-heading ml-list-toolbar";
    const title = document.createElement("h2");
    title.textContent = "Supply Manifest";
    const sourceText = document.createElement("div");
    sourceText.className = "journey-supply-source-text";
    sourceText.innerHTML = (manifest.sources ?? []).map(source => `${actorIdentity(source)}${source.sourceType === "group" ? " (group inventory)" : ""}`).join(" · ");
    const heading = document.createElement("div");
    heading.append(title, sourceText);
    header.append(heading);
    if (!planner) {
      const refresh = document.createElement("button");
      refresh.type = "button";
      refresh.className = "ml-icon-button ml-journeys-icon-button";
      refresh.dataset.action = "refreshSupplies";
      refresh.dataset.tooltip = "Refresh from inventories";
      refresh.setAttribute("aria-label", refresh.dataset.tooltip);
      refresh.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
      header.append(refresh);
    }

    const totals = document.createElement("div");
    totals.className = "ml-grid journey-supply-totals";
    totals.dataset.columns = "auto";
    for (const [label, amount] of [
      ["Food", manifest.totals?.food ?? 0], ["Water (4 pints each)", manifest.waterUnits ?? Math.floor(Number(manifest.totals?.water ?? 0) / 4)],
      ["Tents", manifest.totals?.tent ?? 0], ["Bedrolls", manifest.totals?.bedroll ?? 0],
      ["Blankets", manifest.totals?.blanket ?? 0]
    ]) {
      const total = document.createElement("div");
      total.className = "ml-card ml-stack journey-supply-total";
      total.dataset.gap = "1";
      const strong = document.createElement("strong");
      strong.textContent = amount;
      const text = document.createElement("span");
      text.textContent = label;
      text.className = "ml-eyebrow";
      total.append(text, strong);
      totals.append(total);
    }

    const items = document.createElement("div");
    items.className = "ml-grid journey-supply-items";
    items.dataset.columns = "2";
    for (const source of manifest.sources ?? []) {
      const card = document.createElement("div");
      card.className = "ml-card ml-stack";
      card.dataset.gap = "2";
      const owner = document.createElement("div");
      owner.innerHTML = actorIdentity(source);
      if (source.sourceType === "group") owner.append(" (shared inventory)");
      const list = document.createElement("dl");
      list.className = "ml-quantity-list";
      for (const item of SupplyManifestService.orderItems((manifest.items ?? []).filter(item => item.sourceActorUuid === source.actorUuid))) {
        const name = document.createElement("dt");
        name.textContent = item.name;
        const quantity = document.createElement("dd");
        quantity.textContent = String(item.quantity);
        list.append(name, quantity);
      }
      card.append(owner);
      if (list.childElementCount) card.append(list);
      else {
        const empty = document.createElement("p");
        empty.className = "ml-empty-message";
        empty.textContent = "No recognized travel supplies.";
        card.append(empty);
      }
      items.append(card);
    }
    if (!(manifest.sources?.length)) {
      const empty = document.createElement("p");
      empty.className = "ml-empty-message";
      empty.textContent = "Select travelers to review their supplies.";
      items.append(empty);
    }
    panel.append(header, totals, items);
    roles.after(panel);
  }

  static async createJourney(event) {
    event.preventDefault();
    try {
      const travelerUuids = Array.from(this.element.querySelectorAll("[name='travelerUuid']:checked"), input => input.value);
      if (!travelerUuids.length) throw new Error("Select at least one traveler.");
      const actors = (await Promise.all(travelerUuids.map(uuid => fromUuid(uuid)))).filter(Boolean);
      const longRestHours = new Map(Array.from(this.element.querySelectorAll("[name='longRestHours']"), input => [input.dataset.actorUuid, Number(input.value)]));
      const navigatorUuid = value(this.element, "navigatorUuid");
      const observerUuid = value(this.element, "observerUuid");
      const quartermasterUuid = value(this.element, "quartermasterUuid");
      if (!navigatorUuid || !observerUuid || !quartermasterUuid) throw new Error("Assign all expedition roles.");
      validateExpeditionRoles({ navigatorUuid, observerUuid });

      const route = createRoute({
        id: crypto.randomUUID(), origin: { name: value(this.element, "origin") }, destination: { name: value(this.element, "destination") },
        lengthSteps: integer(this.element, "lengthDays", 1) * 3 + integer(this.element, "lengthThirds", 0),
        danger: integer(this.element, "danger", 1), discoveryDC: integer(this.element, "discoveryDC", 15),
        resourcesDC: integer(this.element, "resourcesDC", 15), navigationDC: integer(this.element, "navigationDC", 10)
      });
      let journey = createJourney({
        id: crypto.randomUUID(), route,
        travelers: actors.map(actor => dnd5e.snapshotTraveler(actor, { longRestHours: longRestHours.get(actor.uuid) }))
      });
      journey.steps = readJourneySteps(this.element);
      const partyActor = supplies.findPartyActor(travelerUuids);
      journey.partyActorUuid = partyActor?.uuid ?? null;
      journey.roles = { navigatorUuid, observerUuid, quartermasterUuid };
      journey.supplies = await supplies.build({ travelerUuids, partyActorUuid: journey.partyActorUuid });
      journey = readyJourney(journey);
      await saveActiveJourney(journey);
      ui.notifications.info("Journey created with party roles and supplies.");
      await this.render({ force: true });
    } catch (error) {
      console.error("Morelord Journeys | Unable to create journey.", error);
      ui.notifications.error(error.message);
    }
  }

  static async saveJourneyDefaults(event) {
    event.preventDefault();
    try {
      if (!game.user.isGM) throw new Error("Only the GM can save journey defaults.");
      await game.settings.set(MODULE_ID, JOURNEY_PLANNER_DEFAULTS_SETTING, readPlannerDefaults(this.element));
      ui.notifications.info("All journey creation choices saved as defaults for new journeys.");
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async refreshSupplies(event) {
    event.preventDefault();
    const journey = await getActiveJourney();
    journey.supplies = await supplies.build({
      travelerUuids: journey.travelers.map(traveler => traveler.actorUuid),
      partyActorUuid: journey.partyActorUuid
    });
    await saveActiveJourney(journey);
    ui.notifications.info("Supply manifest refreshed from inventories.");
    await this.render({ force: true });
  }
}
