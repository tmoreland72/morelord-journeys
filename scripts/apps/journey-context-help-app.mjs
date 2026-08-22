import { JourneyRoleApplication as BaseJourneyApplication } from "./journey-role-app.mjs";

const HELP = Object.freeze({
  navigator: {
    title: "Navigator",
    content: "The Navigator makes the daily Survival check against the route's Navigation DC. A success applies the day's progress, a failure makes no progress, and failure by 5 or more can turn the party around and reverse progress."
  },
  observer: {
    title: "Observer",
    content: "The Observer uses Perception to notice discovery leads along the route. Finding a lead does not force a diversion—the party decides whether to pursue it and spend travel time."
  },
  lengthDays: {
    title: "Length (Days)",
    content: "The route's expected duration at a normal pace with successful navigation and no delays. Journeys stores each day as three progress steps. Routes may be from 1 to 100 days long."
  },
  danger: {
    title: "Danger",
    content: "Danger controls encounter frequency. Each travel day rolls one d4 per Danger level; every result of 1 creates a potential encounter. Higher Danger means more exposure, not necessarily harder combat."
  },
  discoveryDC: {
    title: "Discovery DC",
    content: "The Perception DC the Observer must meet to notice an optional discovery lead. Lower values represent secret, uncharted, or discovery-rich routes; higher values represent familiar roads with fewer hidden opportunities."
  },
  resourcesDC: {
    title: "Resources DC",
    content: "The difficulty of finding food and water along the route. Lower values represent abundant natural environments; higher values represent depleted, barren, or hostile terrain. Craftworks Gather is offered during this phase when available."
  },
  navigationDC: {
    title: "Navigation DC",
    content: "The Survival DC used by the Navigator to keep the party on course. Easy roads may require little or no navigation, while uncharted or featureless terrain should use a higher value."
  }
});

const FIELD_HELP = Object.freeze({
  navigatorUuid: "navigator",
  activeNavigatorUuid: "navigator",
  observerUuid: "observer",
  activeObserverUuid: "observer",
  lengthDays: "lengthDays",
  danger: "danger",
  discoveryDC: "discoveryDC",
  resourcesDC: "resourcesDC",
  navigationDC: "navigationDC"
});

export class JourneyContextHelpApplication extends BaseJourneyApplication {
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#configureRouteRatings();
    this.#attachHelpButtons();
  }

  #configureRouteRatings() {
    const length = this.element.querySelector("[name='lengthDays']");
    if (length) length.max = "100";

    const danger = this.element.querySelector("input[name='danger']");
    if (!danger) return;
    const current = danger.value;
    const select = document.createElement("select");
    select.name = "danger";
    const choices = [
      ["0", "0 — None (no encounter checks)"],
      ["1", "1 — Safe or civilized (1 check/day)"],
      ["2", "2 — Untamed wilderness (2 checks/day)"],
      ["3", "3 — Hostile territory (3 checks/day)"],
      ["4", "4 — Extremely dangerous (4 checks/day)"],
      ["5", "5 — Lethal or otherworldly (5 checks/day)"]
    ];
    for (const [choiceValue, label] of choices) {
      const option = document.createElement("option");
      option.value = choiceValue;
      option.textContent = label;
      option.selected = choiceValue === current;
      select.append(option);
    }
    danger.replaceWith(select);
  }

  #attachHelpButtons() {
    for (const [fieldName, helpId] of Object.entries(FIELD_HELP)) {
      const field = this.element.querySelector(`[name='${fieldName}']`);
      const heading = field?.closest("label")?.querySelector(":scope > span");
      if (!heading || heading.querySelector(".journey-help-button")) continue;
      heading.classList.add("journey-field-heading");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "journey-help-button";
      button.dataset.help = helpId;
      button.setAttribute("aria-label", `About ${HELP[helpId].title}`);
      button.dataset.tooltip = `About ${HELP[helpId].title}`;
      const icon = document.createElement("i");
      icon.className = "fa-solid fa-circle-question";
      button.append(icon);
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        void this.#showHelp(helpId);
      });
      heading.append(button);
    }
  }

  async #showHelp(helpId) {
    const help = HELP[helpId];
    if (!help) return;
    await foundry.applications.api.DialogV2.prompt({
      window: { title: help.title, icon: "fa-solid fa-circle-question" },
      content: `<div class="ml-journeys-help-content"><p>${help.content}</p></div>`,
      ok: { label: "Close", icon: "fa-solid fa-check" },
      modal: true,
      rejectClose: false
    });
  }
}
