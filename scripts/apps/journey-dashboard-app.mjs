import { Dnd5eJourneyAdapter } from "../adapters/dnd5e-journey-adapter.mjs";
import { createJourney } from "../domain/journey.mjs";
import { createRoute } from "../domain/route.mjs";
import { saveActiveJourney, getActiveJourney } from "../foundry/settings-repository.mjs";
import { CraftworksGatherIntegration } from "../integrations/craftworks-gather-integration.mjs";
import { JourneyApplication as BaseJourneyApplication } from "./journey-app.mjs";

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
    position: { width: 760, height: 680 },
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
    const ratings = this.element.querySelector(".journey-grid.ratings")?.previousElementSibling;
    if (!ratings) return;
    const section = document.createElement("section");
    section.className = "journey-party-planner";
    const heading = document.createElement("h2");
    heading.textContent = "Expedition Party";
    section.append(heading);

    if (!travelers.length) {
      const empty = document.createElement("p");
      empty.textContent = "No D&D 5e character actors are available.";
      section.append(empty);
      ratings.before(section);
      return;
    }

    const list = document.createElement("div");
    list.className = "ml-grid ml-journeys-traveler-list";
    list.dataset.columns = "2";
    for (const traveler of travelers) {
      const label = document.createElement("label");
      label.className = "ml-choice-card ml-journeys-traveler";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "travelerUuid";
      input.value = traveler.uuid;
      input.checked = traveler.hasPlayerOwner;
      const image = document.createElement("img");
      image.src = traveler.img;
      image.alt = "";
      const name = document.createElement("span");
      name.textContent = traveler.name;
      label.append(input, image, name);
      list.append(label);
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
    ratings.before(section);
  }

  #renderCraftworksGather(context) {
    const notesLabel = this.element.querySelector(".journey-phase-card > [data-action='advancePhase']");
    if (!notesLabel) return;
    const panel = document.createElement("div");
    panel.className = "ml-journeys-panel journey-card journey-craftworks-integration";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = context.craftworksGather.available ? "Morelord Craftworks available" : "Manual foraging";
    const description = document.createElement("p");
    description.textContent = context.craftworksGather.available
      ? "Use Craftworks Gather for this foraging phase. Gather uses the current active scene."
      : "Record the party's foraging results below. Enable Morelord Craftworks to use Gather.";
    copy.append(title, description);
    panel.append(copy);
    if (context.craftworksGather.available) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = "openCraftworksGather";
      button.classList.add("journey-emphasis-button");
      button.textContent = "Open Morelord Craftworks - Gather";
      panel.append(button);
    }
    notesLabel.before(panel);
  }

  #renderNavigator(context) {
    const outcome = this.element.querySelector("[name='navigationOutcome']")?.closest("label");
    if (!outcome) return;
    const panel = document.createElement("div");
    panel.className = "ml-journeys-panel journey-card journey-navigator-panel";
    const name = document.createElement("strong");
    name.textContent = context.navigator ? `Navigator: ${context.navigator.name}` : "No navigator assigned";
    const detail = document.createElement("p");
    detail.textContent = `Survival check · DC ${context.route.navigationDC ?? "automatic"}`;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = "rollNavigation";
    button.disabled = !context.navigator;
    button.textContent = "Roll Navigation";
    panel.append(name, detail, button);
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
        name: value(this.element, "routeName"),
        origin: { name: value(this.element, "origin") },
        destination: { name: value(this.element, "destination") },
        lengthSteps: integer(this.element, "lengthDays", 1) * 3,
        danger: integer(this.element, "danger", 1),
        discoveryDC: integer(this.element, "discoveryDC", 15),
        resourcesDC: integer(this.element, "resourcesDC", 15),
        navigationDC: integer(this.element, "navigationDC", 10)
      });
      const journey = createJourney({
        id: crypto.randomUUID(),
        name: value(this.element, "journeyName"),
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
      const notes = this.element.querySelector("[name='foragingNotes']");
      if (notes && !notes.value.trim()) notes.value = "Foraging handled through Morelord Craftworks Gather.";
    } catch (error) {
      console.error("Morelord Journeys | Unable to open Craftworks Gather.", error);
      ui.notifications.error(error.message);
    }
  }

  static async rollNavigation(event) {
    event.preventDefault();
    try {
      const result = await dnd5e.rollNavigation(await getActiveJourney());
      if (result.cancelled) return;
      const select = this.element.querySelector("[name='navigationOutcome']");
      if (select) select.value = result.outcome;
      ui.notifications.info(`${result.actorName}: ${result.total ?? "automatic success"} — ${result.outcome}`);
    } catch (error) {
      console.error("Morelord Journeys | Navigation roll failed.", error);
      ui.notifications.error(error.message);
    }
  }
}
