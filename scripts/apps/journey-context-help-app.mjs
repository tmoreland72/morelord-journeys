import { JourneyRoleApplication as BaseJourneyApplication } from "./journey-role-app.mjs";
import { getDCConfiguration } from "../core/journey-settings.mjs";

const sections = (...groups) => groups.map(([heading, items]) => `<section><h3>${heading}</h3><ul>${items.map(item => `<li>${item}</li>`).join("")}</ul></section>`).join("");

const HELP = Object.freeze({
  navigator: {
    title: "Navigator",
    content: sections(["Check", ["Roll Survival against the Navigation DC."]], ["Results", ["Success: apply progress.", "Natural 1: turned around; lose one day.", "Natural 20: shortcut; gain ⅓ day.", "Other failure: lost; no progress."]])
  },
  observer: {
    title: "Observer",
    content: sections(["Check", ["Roll Perception against the Discovery DC."]], ["Result", ["Success reveals a clue.", "The party chooses whether to investigate.", "Investigation time is recorded when travel resumes."]])
  },
  lengthDays: {
    title: "Length (Days)",
    content: sections(["Entry", ["Choose whole days plus 0, ⅓, or ⅔.", "Example: 4 days and ⅔ equals 14 thirds."]])
  },
  danger: {
    title: "Danger",
    content: sections(["Modifier", ["Danger 0: −10", "Danger 1: +0", "Danger 2: +5", "Danger 3: +10", "Danger 4: +15", "Danger 5: +20"]], ["Effect", ["Higher totals increase major daytime encounters and night attacks."]])
  },
  discoveryDC: {
    title: "Discovery DC",
    content: sections(["Use", ["The Observer rolls Perception against this DC.", "Lower DCs produce more discovery leads."]])
  },
  resourcesDC: {
    title: "Resources DC",
    content: sections(["Use", ["Travelers roll Survival against this DC.", "Lower DCs represent abundant terrain.", "Higher DCs represent sparse or hostile terrain."]])
  },
  navigationDC: {
    title: "Navigation DC",
    content: sections(["Use", ["The Navigator rolls Survival against this DC.", "Roads use lower DCs; uncharted terrain uses higher DCs."]])
  },
  routeTraffic: {
    title: "Route Traffic",
    content: sections(["High Traffic", ["Adds +5 to daytime encounter rolls.", "Adds +5 to night encounter rolls.", "Applied separately from Danger."]])
  },
  weather: { title: "Weather", content: sections(["Extreme Check", ["Roll 1d20.", "Natural 1: use an extreme forecast.", "Any other result: use an ordinary forecast."]], ["Warm Forecast", ["Fair weather", "Rain showers", "Humid haze", "Overcast", "Strong warm winds", "Clear and hot"]], ["Cold Forecast", ["Cold and clear", "Snow flurries", "Freezing drizzle", "Overcast", "Strong cold winds", "Sleet"]], ["Warm Extreme", ["Thunderstorm", "Heat wave", "Flash flood", "Tornado", "Wildfire smoke", "Dust storm"]], ["Cold Extreme", ["Blizzard", "Ice storm", "Extreme cold", "Avalanche conditions", "Freezing fog", "Whiteout"]], ["Effects", ["Extreme weather costs ⅓ day.", "Navigation rolls with disadvantage.", "Sleep DC increases by 5.", "Clear or fair weather cannot be extreme."]]) },
  pace: { title: "Pace", content: sections(["Options", ["Stopped: no progress; advantage on foraging and sleep.", "Slow: ⅔ day; advantage on foraging.", "Normal: 1 day.", "Fast: 1⅓ days; disadvantage on foraging; −5 passive Perception."]]) },
  encounters: { title: "Day Encounters", content: sections(["d100 Result", ["1–40: no encounter", "41–60: signs and foreshadowing", "61–85: minor encounter", "86+: major encounter"]], ["Notes", ["Danger, route, pace, and weather modify the roll.", "Minor and major do not automatically mean combat."]]) },
  discovery: { title: "Discovery", content: sections(["Check", ["The Observer rolls Perception.", "Success reveals a clue and enables the optional d100 lead.", "Failure costs no time."]], ["Investigating", ["Close Journeys and run the discovery.", "Reopen Journeys when travel resumes.", "Record the actual elapsed days and thirds."]]) },
  navigation: { title: "Navigation", content: sections(["Results", ["Success: apply progress.", "Natural 1: turned around; lose one day.", "Natural 20: shortcut; gain ⅓ day.", "Other failure: lost; no progress."]], ["Weather", ["Extreme weather imposes disadvantage."]]) },
  pressOn: { title: "Press On", content: sections(["Benefit", ["Gain ⅓ day of progress."]], ["Cost", ["Every traveler makes the configured Constitution save.", "Failure adds one Exhaustion.", "Resolve every request before continuing."]]) },
  foraging: { title: "Foraging & Supplies", content: sections(["Food", ["Success supplies that traveler's full meal.", "20+ or natural 20 finds food for two.", "Failure consumes a pooled ration."]], ["Water", ["Any success supplies everyone and refills containers.", "Otherwise each Medium traveler needs 4 pints."]]) },
  camp: { title: "Camp", content: sections(["Actions", ["Assignments save automatically.", "Craft, Cook, and Prepare require a fire."]], ["Camp Setup", ["Fire: excellent setup, but visible.", "No fire and no tents: poor setup."]], ["Encounter", ["One d100 determines the night result.", "Record encounter interruption hours before continuing."]]) },
  sleep: { title: "Sleep & Shelter", content: sections(["Setup", ["Sleeping equipment must be personally owned.", "Interruption hours come from Night Encounters."]], ["Long Rest", ["Pass the sleep check.", "Meet the character's required sleep hours.", "Have less than one interrupted hour."]]) }
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
      const group = field?.closest(".ml-field-group");
      const heading = group?.querySelector(":scope > legend") ?? field?.closest("label")?.querySelector(":scope > span");
      if (!heading || heading.querySelector(".journey-help-button")) continue;
      heading.classList.add("journey-field-heading");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ml-icon-button journey-help-button";
      button.dataset.size = "compact";
      button.dataset.variant = "ghost";
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
      button.className = "ml-icon-button journey-help-button";
      button.dataset.size = "compact";
      button.dataset.variant = "ghost";
      button.dataset.help = phaseId;
      button.setAttribute("aria-label", `Explain ${HELP[phaseId].title} outcomes`);
      button.dataset.tooltip = `Explain ${HELP[phaseId].title} outcomes`;
      button.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
      button.addEventListener("click", event => { event.preventDefault(); void this.#showHelp(phaseId); });
      phase.append(" ", button);
    }
  }

  async #showHelp(helpId) {
    const source = HELP[helpId];
    const help = helpId === "pressOn" && source
      ? { ...source, content: source.content.replace("the configured Constitution save", `a DC ${getDCConfiguration().pressOn} Constitution save`) }
      : source;
    if (!help) return;
    await foundry.applications.api.DialogV2.prompt({
      window: { title: help.title, icon: "fa-solid fa-circle-question" },
      content: `<div class="ml-journeys-help-content">${help.content}</div>`,
      ok: { label: "Close", icon: "fa-solid fa-check" },
      modal: true,
      rejectClose: false
    });
  }
}
