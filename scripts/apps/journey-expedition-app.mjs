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
      saveRoles: this.saveRoles,
      refreshSupplies: this.refreshSupplies
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
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!context.hasJourney) this.#augmentPartyPlanner(context.availableTravelers);
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
    grid.className = "journey-role-grid";
    const heading = document.createElement("h2");
    heading.textContent = "Expedition Roles";
    const section = document.createElement("section");
    section.className = "journey-expedition-roles";
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
    const progress = this.element.querySelector(".journey-progress")?.closest("section");
    if (!progress) return;
    const panel = document.createElement("section");
    panel.className = "ml-card ml-stack journey-roles-panel";
    const header = document.createElement("h2");
    header.textContent = neededRole === "navigator" ? "Navigator" : "Observer";
    const grid = document.createElement("div");
    grid.className = "journey-role-grid";
    const navigator = selectField("activeNavigatorUuid", "Navigator");
    const observer = selectField("activeObserverUuid", "Observer");
    for (const traveler of context.journey.travelers) {
      option(navigator.select, { value: traveler.actorUuid, label: traveler.name, selected: traveler.actorUuid === context.journey.roles?.navigatorUuid });
      option(observer.select, { value: traveler.actorUuid, label: traveler.name, selected: traveler.actorUuid === context.journey.roles?.observerUuid });
    }
    const otherRoleUuid = neededRole === "navigator" ? context.journey.roles?.observerUuid : context.journey.roles?.navigatorUuid;
    const activeSelect = neededRole === "navigator" ? navigator.select : observer.select;
    for (const entry of activeSelect.options) entry.disabled = entry.value === otherRoleUuid;
    const active = neededRole === "navigator" ? navigator : observer;
    grid.append(active.field);
    const saveOnChange = async () => {
      const journey = await getActiveJourney();
      validateExpeditionRoles({
        navigatorUuid: neededRole === "navigator" ? active.select.value : journey.roles.navigatorUuid,
        observerUuid: neededRole === "observer" ? active.select.value : journey.roles.observerUuid
      });
      journey.roles[`${neededRole}Uuid`] = active.select.value;
      await saveActiveJourney(journey);
    };
    active.select.addEventListener("change", saveOnChange);
    const hint = document.createElement("small");
    hint.textContent = "Role changes are remembered automatically.";
    panel.append(header, grid, hint);
    progress.after(panel);
  }

  #renderSupplyManifest(context) {
    const roles = this.element.querySelector(".journey-roles-panel") ?? this.element.querySelector(".journey-progress")?.closest("section");
    if (!roles) return;
    const manifest = context.journey.supplies ?? {};
    const panel = document.createElement("section");
    panel.className = "ml-surface ml-stack journey-supply-panel";
    const header = document.createElement("div");
    header.className = "journey-progress-label";
    const title = document.createElement("h2");
    title.textContent = "Supply Manifest";
    const sourceText = document.createElement("small");
    sourceText.className = "journey-supply-source-text";
    sourceText.textContent = (manifest.sources ?? []).map(source => `${source.actorName}${source.sourceType === "group" ? " (group inventory)" : ""}`).join(" · ");
    const heading = document.createElement("div");
    heading.append(title, sourceText);
    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.className = "ml-icon-button ml-journeys-icon-button";
    refresh.dataset.action = "refreshSupplies";
    refresh.dataset.tooltip = "Refresh from inventories";
    refresh.setAttribute("aria-label", refresh.dataset.tooltip);
    refresh.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
    header.append(heading, refresh);

    const totals = document.createElement("div");
    totals.className = "journey-supply-totals";
    for (const [label, amount] of [
      ["Food", manifest.totals?.food ?? 0], ["Water (4 pints each)", manifest.waterUnits ?? Math.floor(Number(manifest.totals?.water ?? 0) / 4)],
      ["Tents", manifest.totals?.tent ?? 0], ["Bedrolls", manifest.totals?.bedroll ?? 0],
      ["Blankets", manifest.totals?.blanket ?? 0]
    ]) {
      const total = document.createElement("div");
      total.className = "journey-supply-total";
      const strong = document.createElement("strong");
      strong.textContent = amount;
      const text = document.createElement("span");
      text.textContent = label;
      total.append(strong, text);
      totals.append(total);
    }

    const items = document.createElement("div");
    items.className = "journey-supply-items";
    for (const item of manifest.items ?? []) {
      const tag = document.createElement("span");
      tag.className = "journey-supply-item";
      const text = document.createElement("span");
      text.textContent = `${item.quantity}× ${item.name} — ${item.sourceActorName}`;
      tag.append(text);
      items.append(tag);
    }
    if (!(manifest.items?.length)) {
      const empty = document.createElement("p");
      empty.textContent = "No recognized travel supplies were found in the Group or traveler inventories.";
      items.append(empty);
    }
    panel.append(header, totals, items);
    const readyForRoad = context.canBeginDay ? this.element.querySelector(".ml-empty-state") : null;
    (readyForRoad ?? roles).after(panel);
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
        id: crypto.randomUUID(), name: value(this.element, "routeName"),
        origin: { name: value(this.element, "origin") }, destination: { name: value(this.element, "destination") },
        lengthSteps: integer(this.element, "lengthDays", 1) * 3 + integer(this.element, "lengthThirds", 0),
        danger: integer(this.element, "danger", 1), discoveryDC: integer(this.element, "discoveryDC", 15),
        resourcesDC: integer(this.element, "resourcesDC", 15), navigationDC: integer(this.element, "navigationDC", 10),
        traffic: value(this.element, "routeTraffic") || "ordinary"
      });
      let journey = createJourney({
        id: crypto.randomUUID(), name: value(this.element, "journeyName"), route,
        travelers: actors.map(actor => dnd5e.snapshotTraveler(actor, { longRestHours: longRestHours.get(actor.uuid) }))
      });
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

  static async saveRoles(event) {
    event.preventDefault();
    const journey = await getActiveJourney();
    journey.roles = validateExpeditionRoles({
      navigatorUuid: value(this.element, "activeNavigatorUuid"),
      observerUuid: value(this.element, "activeObserverUuid")
    });
    journey.roles = {
      ...journey.roles,
      quartermasterUuid: value(this.element, "activeQuartermasterUuid")
    };
    await saveActiveJourney(journey);
    ui.notifications.info("Expedition roles updated.");
    await this.render({ force: true });
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
