import { actorIdentity } from "../../../morelord-core/scripts/ui/actor-identity.js";
import { Dnd5eJourneyAdapter } from "../adapters/dnd5e-journey-adapter.mjs";
import { createJourney } from "../domain/journey.mjs";
import { createRoute } from "../domain/route.mjs";
import { saveActiveJourney, getActiveJourney } from "../foundry/settings-repository.mjs";
import { CraftworksGatherIntegration } from "../integrations/craftworks-gather-integration.mjs";
import { JourneyApplication as BaseJourneyApplication } from "./journey-app.mjs";
import { createOutcomeDetails } from "../ui/outcome-details.mjs";

const craftworksGather = new CraftworksGatherIntegration();
const dnd5e = new Dnd5eJourneyAdapter();
const value = (element, name) => element.querySelector(`[name="${name}"]`)?.value ?? "";
const integer = (element, name, fallback = 0) => {
  const parsed = Number.parseInt(value(element, name), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

export class JourneyApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = {
      classes: ["ml-window", "ml-journeys-module", "ml-journeys-window", "ml-journeys-dashboard-window"],
    position: { width: 1180, height: 880 },
    window: { title: "Morelord Journeys", icon: "fa-solid fa-person-hiking", resizable: true },
    actions: {
      createJourney: this.createJourney,
      openCraftworksGather: this.openCraftworksGather,
      rollNavigation: this.rollNavigation
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (context.phases) context.phases = context.phases.map((phase, index) => ({ ...phase, number: index + 1 }));
    context.craftworksGather = craftworksGather.snapshot();
    context.availableTravelers = dnd5e.getAvailableTravelers();
    if (context.journey) {
      context.navigator = context.journey.travelers.find(
        traveler => traveler.actorUuid === context.journey.roles?.navigatorUuid
      ) ?? null;
    }
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!context.hasJourney) this.#renderPartyPlanner(context.availableTravelers);
    if (context.phaseIs?.foraging) this.#renderCraftworksGather(context);
    if (context.phaseIs?.navigation) this.#renderNavigator(context);
  }

  #renderPartyPlanner(travelers) {
    const ratings = this.element.querySelector(".journey-route-ratings");
    if (!ratings) return;
    const section = document.createElement("section");
    section.className = "ml-surface ml-stack journey-party-planner";
    const heading = document.createElement("div");
    heading.className = "ml-section-heading";
    heading.innerHTML = "<h2>Expedition Party</h2>";
    section.append(heading);

    if (!travelers.length) {
      const empty = document.createElement("p");
      empty.className = "ml-empty-message";
      empty.textContent = "No D&D 5e character actors are available.";
      section.append(empty);
      ratings.after(section);
      return;
    }

    const list = document.createElement("div");
    list.className = "ml-grid ml-journeys-traveler-list";
    list.dataset.columns = "2";
    for (const traveler of travelers) {
      const card = document.createElement("div");
      card.className = "ml-card ml-item-row ml-journeys-traveler";
      card.dataset.mlSelectableCard = "";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "travelerUuid";
      input.value = traveler.uuid;
      input.checked = traveler.hasPlayerOwner;
      input.setAttribute("aria-label", `Include ${traveler.name} in the expedition`);
      const identity = document.createElement("label");
      identity.className = "ml-check";
      const name = document.createElement("span");
      name.innerHTML = actorIdentity(traveler);
      identity.append(input, name);
      const copy = document.createElement("div");
      copy.className = "ml-stack";
      copy.dataset.gap = "1";
      const rest = document.createElement("label");
      const restLabel = document.createElement("span");
      restLabel.textContent = "Long Rest hours";
      const restInput = document.createElement("input");
      restInput.type = "number";
      restInput.name = "longRestHours";
      restInput.dataset.actorUuid = traveler.uuid;
      restInput.min = "1";
      restInput.max = "24";
      restInput.step = "0.5";
      restInput.value = traveler.longRestHours;
      restInput.setAttribute("aria-label", `Long Rest hours required for ${traveler.name}`);
      const restSource = document.createElement("small");
      restSource.textContent = traveler.longRestHoursSource;
      rest.append(restLabel, restInput);
      copy.append(identity, restSource);
      card.append(copy, rest);
      list.append(card);
    }
    section.append(list);

    const navigatorLabel = document.createElement("label");
    const labelText = document.createElement("span");
    labelText.textContent = "Navigator";
    const select = document.createElement("select");
    select.name = "navigatorUuid";
    navigatorLabel.append(labelText, select);
    section.append(navigatorLabel);

    const syncNavigator = () => {
      const selected = Array.from(list.querySelectorAll("input:checked"));
      const prior = select.value;
      select.replaceChildren();
      for (const input of selected) {
        const traveler = travelers.find(candidate => candidate.uuid === input.value);
        const option = document.createElement("option");
        option.value = traveler.uuid;
        option.textContent = traveler.name;
        select.append(option);
      }
      if (selected.some(input => input.value === prior)) select.value = prior;
    };
    list.addEventListener("change", syncNavigator);
    syncNavigator();
    ratings.after(section);
  }

  #renderCraftworksGather(context) {
    const day = context.journey?.currentDay;
    if (!context.journey?.travelers?.length || day?.pendingForagingRolls?.length
      || !context.journey.travelers.every(traveler => day?.foragingResults?.some(result => result.actorUuid === traveler.actorUuid))) return;
    const notesLabel = this.element.querySelector(".journey-phase-card > [data-action='advancePhase']");
    if (!notesLabel) return;
    const panel = document.createElement("div");
    panel.className = "ml-callout journey-action-callout journey-craftworks-integration";
    panel.dataset.tone = "success";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "Optional Exploration Activities";
    const description = document.createElement("p");
    description.textContent = "This is a good opportunity for characters to gather materials, search the surrounding area, investigate local features, or perform other exploration activities. These activities are separate from food-and-water foraging checks and can be supported by Morelord Craftworks.";
    copy.append(title, description);
    panel.append(copy);
    if (context.craftworksGather.available) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = "openCraftworksGather";
      button.classList.add("ml-button");
      button.textContent = "Launch Morelord Craftworks";
      panel.append(button);
    }
    notesLabel.before(panel);
  }

  #renderNavigator(context) {
    const outcome = this.element.querySelector("[data-navigation-result]");
    if (!outcome) return;
    const panel = document.createElement("div");
    panel.className = "ml-card ml-grid journey-navigator-panel";
    const name = document.createElement("strong");
    name.innerHTML = context.navigator ? `Navigator: ${actorIdentity(context.navigator)}` : "No navigator assigned";
    const detail = document.createElement("p");
    detail.textContent = `Survival check · DC ${context.route.navigationDC ?? "automatic"}`;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = "rollNavigation";
    button.disabled = !context.navigator;
    button.textContent = "Roll Navigation";
    const prior = context.journey.currentDay?.gmNavigationRoll;
    panel.append(name);
    if (prior) {
      const result = document.createElement("p");
      result.className = "ml-status journey-roll-result";
      result.dataset.tone = prior.outcome === "success" ? "success" : "danger";
      result.textContent = `Navigation: ${prior.outcome}.`;
      panel.append(result, createOutcomeDetails({ cards: [{ title: "Navigation Check", rows: [
        { label: "Character", value: prior.actorName, actor: prior },
        { label: "DC", value: prior.dc ?? "Automatic" },
        { label: "Roll", value: prior.total ?? "Automatic success" },
        { label: "Outcome", value: prior.outcome }
      ] }] }), button);
    } else panel.append(detail, button);
    outcome.before(panel);
  }

  static async createJourney(event) {
    event.preventDefault();
    try {
      const selectedUuids = Array.from(this.element.querySelectorAll("[name='travelerUuid']:checked"), input => input.value);
      if (!selectedUuids.length) throw new Error("Select at least one traveler.");
      const actors = await Promise.all(selectedUuids.map(uuid => fromUuid(uuid)));
      const travelers = actors.filter(Boolean).map(actor => dnd5e.snapshotTraveler(actor));
      const navigatorUuid = value(this.element, "navigatorUuid");
      if (!navigatorUuid) throw new Error("Assign a navigator.");

      const route = createRoute({
        id: crypto.randomUUID(),
        origin: { name: value(this.element, "origin") },
        destination: { name: value(this.element, "destination") },
        lengthSteps: integer(this.element, "lengthDays", 1) * 3 + integer(this.element, "lengthThirds", 0),
        danger: integer(this.element, "danger", 1),
        discoveryDC: integer(this.element, "discoveryDC", 15),
        resourcesDC: integer(this.element, "resourcesDC", 15),
        navigationDC: integer(this.element, "navigationDC", 10)
      });
      const journey = createJourney({
        id: crypto.randomUUID(),
        route,
        travelers
      });
      journey.roles.navigatorUuid = navigatorUuid;
      journey.status = "ready";
      await saveActiveJourney(journey);
      ui.notifications.info("Journey created.");
      await this.render({ force: true });
    } catch (error) {
      console.error("Morelord Journeys | Unable to create journey.", error);
      ui.notifications.error(error.message);
    }
  }

  static async openCraftworksGather(event) {
    event.preventDefault();
    try {
      await craftworksGather.open();
    } catch (error) {
      console.error("Morelord Journeys | Unable to open Craftworks Gather.", error);
      ui.notifications.error(error.message);
    }
  }

  static async rollNavigation(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      const result = await dnd5e.rollNavigation(journey);
      if (result.cancelled) return;
      journey.currentDay.gmNavigationRoll = { actorUuid: result.actorUuid, actorName: result.actorName, dc: result.dc, total: result.total, natural: result.natural, outcome: result.outcome, rolledAt: Date.now() };
      await saveActiveJourney(journey);
      await this.render({ force: true });
    } catch (error) {
      console.error("Morelord Journeys | Navigation roll failed.", error);
      ui.notifications.error(error.message);
    }
  }
}
