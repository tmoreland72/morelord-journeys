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
    content: "Enter whole days plus 0, ⅓, or ⅔. Journeys stores the route as integer thirds, so daily modifiers never use rounded decimals. Example: 4 days + ⅔ is stored as 14 thirds."
  },
  danger: {
    title: "Danger",
    content: "One daytime d100 and one nightly d100 are possible. Danger modifies each result: 0 = -10, 1 = +0, 2 = +5, 3 = +10, 4 = +15, 5 = +20. Higher totals move toward Major Encounters or Night Attacks."
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
  },
  routeTraffic: {
    title: "Route Traffic",
    content: "Choose Road or high traffic when travelers are exposed to patrols, merchants, settlements, or other frequent traffic. Journeys then adds +5 to daytime and night encounter totals. This is independent of Danger."
  },
  weather: { title: "Weather", content: "First roll 1d20; a 1 means extreme weather. Then roll a compatible seasonal forecast. Extreme weather costs ⅓ day, gives Navigation disadvantage, and adds 5 to sleep DCs. Clear weather cannot be selected as extreme." },
  pace: { title: "Pace", content: "Stopped = 0 thirds and advantage on forage/sleep; Slow = ⅔ day and foraging advantage; Normal = 1 day; Fast = 1⅓ days, foraging disadvantage, and -5 to the highest passive Perception." },
  encounters: { title: "Day Encounters", content: "Roll one d100. 1–40 none, 41–60 signs, 61–85 minor hazard/discovery/social, 86+ major. Danger and every applicable route, pace, and weather modifier change the total. Journeys shows the highest party passive Perception." },
  discovery: { title: "Discovery", content: "The Observer rolls Perception against Discovery DC. Success reveals a clue. Pursuit normally costs ⅓ day, but the GM may select 0, ⅓, ⅔, or 1 day. The optional d100 produces a prompt, not a complete discovery." },
  navigation: { title: "Navigation", content: "Meet the DC to apply movement. Fail by 1–4 for Lost and no progress. Fail by 5+ for Turned Around and add one full day to the remaining journey. Extreme weather imposes disadvantage." },
  pressOn: { title: "Press On", content: "Add ⅓ day of movement. Every traveler must make a DC 12 Constitution save; failure adds one Exhaustion. Resolve all player requests before continuing." },
  foraging: { title: "Foraging & Supplies", content: "Success provides that traveler a full meal. Failure consumes one pooled ration. Any success finds water for everyone and refills containers; otherwise each Medium traveler consumes 4 pooled pints." },
  camp: { title: "Camp", content: "Assignments save automatically. Craft, Cook, and Prepare require fire. Fire creates excellent setup but attracts attention; no fire and no tents is poor setup. One night d100 selects an affected watch when interrupted." },
  sleep: { title: "Sleep & Shelter", content: "Each traveler uses only personally owned shelter. Record sleep hours and interruption minutes, then roll the Constitution sleep check. Six hours, less than 60 interrupted minutes, and a successful check are required for a Long Rest." }
});

const FIELD_HELP = Object.freeze({
  navigatorUuid: "navigator",
  activeNavigatorUuid: "navigator",
  observerUuid: "observer",
  activeObserverUuid: "observer",
  lengthDays: "lengthDays",
  lengthThirds: "lengthDays",
  danger: "danger",
  discoveryDC: "discoveryDC",
  resourcesDC: "resourcesDC",
  navigationDC: "navigationDC",
  routeTraffic: "routeTraffic"
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
      ["1", "1 — Safe or civilized (+0)"],
      ["2", "2 — Untamed wilderness (+5)"],
      ["3", "3 — Hostile territory (+10)"],
      ["4", "4 — Extremely dangerous (+15)"],
      ["5", "5 — Lethal or otherworldly (+20)"]
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
    const phase = this.element.querySelector(".journey-phase-card h2");
    const phaseLabel = phase?.textContent?.trim().toLowerCase();
    const phaseId = ({ weather: "weather", pace: "pace", encounters: "encounters", discovery: "discovery", navigation: "navigation", "press on": "pressOn", foraging: "foraging", camp: "camp", "sleep & shelter": "sleep" })[phaseLabel];
    if (phase && phaseId && !phase.querySelector(".journey-help-button")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "journey-help-button";
      button.dataset.help = phaseId;
      button.setAttribute("aria-label", `Explain ${HELP[phaseId].title} outcomes`);
      button.dataset.tooltip = `Explain ${HELP[phaseId].title} outcomes`;
      button.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
      button.addEventListener("click", event => { event.preventDefault(); void this.#showHelp(phaseId); });
      phase.append(" ", button);
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
