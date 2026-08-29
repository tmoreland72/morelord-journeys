import { nightEncountersEnabled } from "../core/journey-settings.mjs";
import { assignedWatchIndexes, CAMP_WATCH_COUNT, normalizeCampAssignments, watchCoverage } from "../domain/camp-watch-rules.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { roleRollService } from "../services/role-roll-service.mjs";
import { JourneyActionApplication as BaseJourneyApplication } from "./journey-action-fix-app.mjs";
import { createOutcomeDetails } from "../ui/outcome-details.mjs";
import { readCampAssignments } from "../ui/camp-assignment-controls.mjs";
import { createEncountersCallout } from "../ui/encounters-callout.mjs";

const CAMP_ACTIONS = ["Take a Watch", "Craft", "Cook", "Prepare", "Slumber", "Task"];

function option(value, label, selected) {
  const entry = document.createElement("option");
  entry.value = value;
  entry.textContent = label;
  entry.selected = value === selected;
  return entry;
}

export class JourneyCampApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = {
    actions: {
      resendRoleRoll: this.resendRoleRoll,
      saveCampPlan: this.saveCampPlan
    }
  };

  async _onRender(context, options) {
    await super._onRender(context, options);
    const pending = context.journey && context.journey.currentDay?.pendingRoleRoll;
    if (pending) this.#addResendButton();
    if (context.phaseIs?.camp) this.#renderCamp(context);
  }

  #addResendButton() {
    const controls = this.element.querySelector(".journey-roll-controls");
    if (!controls || controls.querySelector("[data-action='resendRoleRoll']")) return;
    const resend = document.createElement("button");
    resend.type = "button";
    resend.dataset.action = "resendRoleRoll";
    resend.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Again';
    controls.prepend(resend);
    controls.classList.add("journey-roll-controls-three");
  }

  #renderCamp(context) {
    const notes = this.element.querySelector(".journey-phase-card > [data-action='advancePhase']");
    if (!notes) return;
    const saved = context.journey.currentDay?.campWatches ?? [];
    const assignments = normalizeCampAssignments(context.journey.travelers, saved);
    const panel = document.createElement("section");
    panel.className = "ml-card ml-stack journey-camp-planner";
    panel.innerHTML = `<header><h3>Watch Order & Camp Actions</h3><p>Assignments save automatically. Only Slumber counts as sleep during this two-hour camp period; every other camp action reduces available sleep by two hours.</p></header><div><label class="journey-check"><input type="checkbox" name="campfire" ${context.journey.currentDay?.campfire ? "checked" : ""}><span>Camp has a visible fire</span></label><button type="button" class="ml-icon-button journey-help-button" data-size="compact" data-variant="ghost" data-campfire-help aria-label="Explain campfire effects" data-tooltip="Explain campfire effects"><i class="fa-solid fa-circle-question"></i></button></div>`;
    panel.querySelector("[data-campfire-help]").addEventListener("click", event => {
      event.preventDefault();
        void foundry.applications.api.DialogV2.prompt({ window: { title: "Campfire Effects", icon: "fa-solid fa-circle-question" }, content: "<div class='ml-journeys-help-content'><section><h3>Required For</h3><ul><li>Craft</li><li>Cook</li><li>Prepare</li></ul></section><section><h3>Night Encounter</h3><ul><li>Excellent setup: −10</li><li>Visible fire: +5</li><li>Net modifier: −5</li><li>No fire and no tents: +10</li></ul></section></div>", ok: { label: "Close" } });
    });
    const watches = document.createElement("div");
    watches.className = "journey-watch-list";
    const nightEncounter = context.journey.currentDay?.nightEncounterCheck;
    const nightOutcomeLabel = { peacefulRest: "Peaceful Rest", uneventful: "Uneventful Night", minor: "Minor Encounter", nightAttack: "Night Attack" }[nightEncounter?.outcome] ?? null;
    for (let index = 0; index < assignments.length; index += 1) {
      const prior = assignments[index];
      const row = document.createElement("div");
      row.className = "journey-watch-row";
      row.dataset.assignmentIndex = String(index);
      row.dataset.actorUuid = prior.actorUuid;
      const heading = document.createElement("strong");
      heading.textContent = prior.actorName;
      const action = document.createElement("select");
      action.name = `watchAction${index}`;
      for (const name of CAMP_ACTIONS) action.append(option(name, name, prior.action ?? "Take a Watch"));
      const period = document.createElement("select");
      period.name = `watchPeriod${index}`;
      period.setAttribute("aria-label", `Watch period for ${prior.actorName}`);
      for (let watchIndex = 0; watchIndex < CAMP_WATCH_COUNT; watchIndex += 1) period.append(option(String(watchIndex), `Watch ${watchIndex + 1}`, String(prior.watchIndex)));
      period.hidden = action.value !== "Take a Watch";
      const additionalPeriod = document.createElement("select");
      additionalPeriod.name = `additionalWatchPeriod${index}`;
      additionalPeriod.dataset.additionalWatchAvailable = String(Number(context.journey.travelers[index]?.longRestHours ?? 6) <= 4);
      additionalPeriod.setAttribute("aria-label", `Additional watch period for ${prior.actorName}`);
      additionalPeriod.append(option("", "No additional watch", ""));
      for (let watchIndex = 0; watchIndex < CAMP_WATCH_COUNT; watchIndex += 1) additionalPeriod.append(option(String(watchIndex), `Also take Watch ${watchIndex + 1}`, String(prior.watchIndexes?.[1] ?? "")));
      additionalPeriod.hidden = action.value !== "Take a Watch" || additionalPeriod.dataset.additionalWatchAvailable !== "true";
      const result = document.createElement("span");
      result.className = "journey-watch-result";
      const perception = context.journey.currentDay?.campPerceptionResults?.find(entry => entry.actorUuid === prior.actorUuid);
      const pendingPerception = context.journey.currentDay?.pendingCampPerceptionRolls?.some(entry => entry.actorUuid === prior.actorUuid);
      const selectedWatch = assignedWatchIndexes(prior).includes(Number(nightEncounter?.watchIndex));
      result.textContent = selectedWatch && perception
        ? `Perception ${perception.total} · ${nightOutcomeLabel}`
        : selectedWatch && pendingPerception ? `Waiting for Perception · ${nightOutcomeLabel}`
          : selectedWatch ? `${nightOutcomeLabel} · Perception not requested`
            : nightEncounter && ["minor", "nightAttack"].includes(nightEncounter.outcome) ? "Not the affected watch"
              : nightOutcomeLabel ?? "Night encounter not rolled";
      row.append(heading, action, period, additionalPeriod, result);
      watches.append(row);
    }
    panel.append(watches);
    const coverage = document.createElement("div");
    coverage.className = "journey-watch-coverage";
    coverage.innerHTML = `<h4>Watch Coverage</h4>${watchCoverage(assignments).map((watcher, watchIndex) => {
      return `<div><strong>Watch ${watchIndex + 1}</strong><span class="${watcher ? "" : "is-unwatched"}">${foundry.utils.escapeHTML(watcher?.actorName ?? "Unwatched")}</span></div>`;
    }).join("")}`;
    panel.append(coverage);
    const validation = document.createElement("p");
    validation.className = "ml-text journey-camp-validation";
    validation.dataset.tone = "danger";
    validation.hidden = true;
    panel.append(validation);
    if (nightEncountersEnabled() && !nightEncounter) {
      const rollNight = document.createElement("button");
      rollNight.type = "button";
      rollNight.dataset.action = "rollNightEncounter";
      rollNight.textContent = "Roll Night Encounter";
      const nightHelp = document.createElement("button");
      nightHelp.type = "button";
      nightHelp.className = "ml-icon-button journey-help-button";
      nightHelp.dataset.size = "compact";
      nightHelp.dataset.variant = "ghost";
      nightHelp.dataset.action = "showNightEncounterOutcomes";
      nightHelp.setAttribute("aria-label", "Explain night encounter outcomes");
      nightHelp.dataset.tooltip = "Explain night encounter outcomes";
      nightHelp.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
      const nightControls = document.createElement("div");
      nightControls.className = "ml-cluster journey-night-controls";
      nightControls.append(rollNight, nightHelp);
      panel.append(nightControls);
    }
    const night = nightEncounter;
    if (night) {
      const label = { peacefulRest: "Peaceful Rest", uneventful: "Uneventful Night", minor: "Minor Encounter", nightAttack: "Night Attack" }[night.outcome] ?? night.outcome;
      const descriptions = {
        peacefulRest: "The camp remains exceptionally calm. Continue to Sleep & Shelter to confirm each traveler’s rest; this result reduces the sleep DC by 5.",
        uneventful: "No encounter occurs. Continue to Sleep & Shelter to confirm each traveler’s final rest outcome.",
        minor: "A hazard, discovery, or social scene occurs—for example strange tracks, a distressed traveler, unstable ground, or nearby activity. If it becomes combat, record the actual interrupted hours during Sleep & Shelter.",
        nightAttack: "A combat encounter interrupts the selected watch. One interrupted hour is prefilled in Sleep & Shelter; adjust it to the actual duration before rolling."
      };
      const summary = document.createElement("div");
      summary.className = "journey-encounter-summary journey-encounter-outcome";
      summary.innerHTML = `<h4>${label}</h4><p>${descriptions[night.outcome] ?? "Resolve the result, then continue to Sleep & Shelter."}</p><p><em>Pending confirmation after Sleep & Shelter.</em></p>`;
      panel.append(summary);
      if (["minor", "nightAttack"].includes(night.outcome)) {
        const interruption = document.createElement("fieldset");
        interruption.className = "ml-field-group journey-night-interruption";
        const currentHours = Number(context.journey.currentDay?.sleepInterruptions?.[0]?.hours ?? 1);
        interruption.innerHTML = `<legend>Sleep Interruption</legend><label><span>Hours</span><input type="number" name="nightInterruptionHours" min="0" max="8" step="0.25" value="${currentHours}"></label><small>Enter the actual time the encounter interrupted the night. This applies to every traveler.</small>`;
        panel.append(interruption);
      }
      panel.append(createOutcomeDetails({ cards: [{ title: "Night Encounter Calculation", rows: [
        { label: "Raw d100", value: night.raw },
        { label: `Danger ${night.danger}`, value: `${night.dangerModifier >= 0 ? "+" : ""}${night.dangerModifier}` },
        ...(night.modifiers ?? []).map(item => ({ label: item.label, value: `${item.value >= 0 ? "+" : ""}${item.value}` })),
        { label: "Final result", value: night.modified },
        { label: "Outcome", value: label },
        { label: "Affected watch roll", value: night.watchRoll },
        { label: "Affected watch", value: Number.isInteger(night.watchIndex) ? `Watch ${night.watchIndex + 1}` : null },
        { label: "Watch coverage", value: Number.isInteger(night.watchIndex) ? night.unwatched ? "Unwatched — no Perception check is requested" : night.watcherActorName : null }
      ] }] }));
      if (["minor", "nightAttack"].includes(night.outcome)) {
        panel.append(createEncountersCallout());
      }
    }
    notes.before(panel);
    const syncValidity = () => {
      let message = "";
      try { readCampAssignments(this.element, context.journey); }
      catch (error) { message = error.message; }
      validation.hidden = !message;
      validation.textContent = message ? `${message} Resolve the watch assignments before rolling or continuing.` : "";
      const rollNight = panel.querySelector("[data-action='rollNightEncounter']");
      if (rollNight) rollNight.disabled = Boolean(message);
      notes.disabled = Boolean(message);
      if (message) {
        const tooltip = "Resolve the invalid watch assignments first.";
        if (rollNight) rollNight.dataset.tooltip = tooltip;
        notes.dataset.tooltip = tooltip;
      } else {
        if (rollNight) delete rollNight.dataset.tooltip;
        delete notes.dataset.tooltip;
      }
    };
    panel.addEventListener("change", event => {
      if (event.target.matches("select[name^='watchAction'], select[name^='watchPeriod'], select[name^='additionalWatchPeriod']")) syncValidity();
    });
    syncValidity();
  }

  static async resendRoleRoll(event) {
    event.preventDefault();
    try {
      await roleRollService.resend();
      ui.notifications.info("The roll request was sent again.");
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async saveCampPlan(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      journey.currentDay.campWatches = readCampAssignments(this.element, journey);
      journey.currentDay.campfire = Boolean(this.element.querySelector("[name='campfire']")?.checked);
      journey.currentDay.campSetupTotal = Number(this.element.querySelector("[name='campSetupTotal']")?.value ?? 10);
      await saveActiveJourney(journey);
      ui.notifications.info("Camp watch order saved.");
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

}
