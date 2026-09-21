import { nightEncounterTiming } from "../domain/encounter-rules.mjs";
import { readNightInterruptions } from "../ui/night-interruption-controls.mjs";
import { campPerceptionRollService } from "../services/camp-perception-roll-service.mjs";
import { actorIdentity } from "../../../morelord-core/scripts/ui/actor-identity.js";
import { nightEncountersEnabled } from "../core/journey-settings.mjs";
import { assignedWatchIndexes, campWatchTiming, availableCampSleepHours, campPeriods, campWatchAction, normalizeCampAssignments, watchCoverage } from "../domain/camp-watch-rules.mjs";
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
    panel.className = "ml-stack journey-camp-planner";
    panel.innerHTML = `<header class="ml-stack" data-gap="1"><h3>Plan the Eight-Hour Night</h3><p>Each column is two hours. Assign one watcher per period, then choose their activity. Everyone else can sleep or take camp actions. Keeping watch rolls Perception normally; other watch activities roll at disadvantage. Changes save automatically.</p></header><div><label class="ml-toggle journey-check"><input type="checkbox" name="campfire" ${context.journey.currentDay?.campfire ? "checked" : ""}><span>Camp has a visible fire</span></label><button type="button" class="ml-icon-button journey-help-button" data-size="compact" data-variant="ghost" data-campfire-help aria-label="Explain campfire effects" data-tooltip="Explain campfire effects"><i class="fa-solid fa-circle-question"></i></button></div>`;
    panel.querySelector("[data-campfire-help]").addEventListener("click", event => {
      event.preventDefault();
        void foundry.applications.api.DialogV2.prompt({ window: { title: "Campfire Effects", icon: "fa-solid fa-circle-question" }, content: "<div class='ml-journeys-help-content'><section><h3>Required For</h3><ul><li>Craft</li><li>Cook</li><li>Prepare</li></ul></section><section><h3>Night Encounter</h3><ul><li>A visible fire makes a night die result of 1 or 2 trigger an encounter.</li><li>Without a fire, only 1 triggers an encounter.</li></ul></section></div>", ok: { label: "Close" } });
    });
    const watches = document.createElement("div");
    watches.className = "ml-stack journey-watch-list";
    const nightEncounter = context.journey.currentDay?.nightEncounterCheck;
    const nightOutcomeLabel = { peacefulRest: "Peaceful Rest", uneventful: "Uneventful Night", minor: "Minor Encounter", nightAttack: "Night Attack" }[nightEncounter?.outcome] ?? (nightEncounter?.outcome === "encounter" ? "Night Encounter" : null);
    if (["minor", "nightAttack"].includes(nightEncounter?.outcome)) {
      const notice = document.createElement("div");
      notice.className = "ml-callout ml-journeys-night-timing";
      notice.dataset.tone = "warning";
      notice.setAttribute("role", "status");
      notice.innerHTML = `<i class="fa-solid fa-moon" aria-hidden="true"></i><div><strong>${nightOutcomeLabel} — ${campWatchTiming(nightEncounter.watchIndex)}</strong><p>${nightEncounter.unwatched ? "This period is unwatched; no Perception check is requested." : `${actorIdentity({ actorUuid: nightEncounter.watcherActorUuid, actorName: nightEncounter.watcherActorName })} is on watch.`}</p><p>Resolve this encounter during the indicated period before continuing to Sleep & Shelter.</p></div>`;
      panel.prepend(notice);
    }
    for (let index = 0; index < assignments.length; index += 1) {
      const prior = assignments[index];
      const row = document.createElement("div");
      row.className = "ml-stack ml-card journey-watch-row";
      row.dataset.assignmentIndex = String(index);
      row.dataset.actorUuid = prior.actorUuid;
      const heading = document.createElement("strong");
      heading.innerHTML = actorIdentity({ ...context.journey.travelers.find(traveler => traveler.actorUuid === prior.actorUuid), ...prior });
      const summary = document.createElement("span");
      summary.className = "journey-camp-rest-summary";
      summary.setAttribute("aria-live", "polite");
      const header = document.createElement("header");
      header.className = "journey-camp-character-heading";
      header.append(heading, summary);
      const schedule = document.createElement("div");
      schedule.className = "journey-camp-periods";
      campPeriods(prior).forEach((period, periodIndex) => {
        const slot = document.createElement("div");
        slot.className = "ml-stack ml-card journey-camp-period";
        const title = document.createElement("strong");
        title.textContent = `Period ${periodIndex + 1}: ${periodIndex * 2}-${periodIndex * 2 + 2}h`;
        const duty = document.createElement("label");
        duty.className = "ml-toggle journey-check";
        const watch = document.createElement("input");
        watch.type = "checkbox";
        watch.name = `campWatch${index}-${periodIndex}`;
        watch.checked = period.watch;
        const dutyLabel = document.createElement("span");
        dutyLabel.textContent = "On watch";
        watch.setAttribute("aria-label", `${prior.actorName}: on watch in period ${periodIndex + 1}`);
        duty.append(watch, dutyLabel);
        const action = document.createElement("select");
        action.name = `watchAction${index}-${periodIndex}`;
        action.setAttribute("aria-label", `${prior.actorName}: activity in period ${periodIndex + 1}`);
        for (const name of CAMP_ACTIONS) action.append(option(name, name === "Slumber" ? "Sleep" : name === "Take a Watch" ? "Keep watch" : name, period.action));
        const hint = document.createElement("small");
        const sync = () => {
          slot.dataset.state = watch.checked ? "watch" : action.value === "Slumber" ? "sleep" : "action";
          hint.textContent = watch.checked ? action.value === "Take a Watch" ? "Perception: normal" : "Perception: disadvantage" : action.value === "Slumber" ? "2 hours of sleep" : "2 hours awake";
        };
        watch.addEventListener("change", () => {
          if (watch.checked && action.value === "Slumber") action.value = "Take a Watch";
          if (!watch.checked && action.value === "Take a Watch") action.value = "Slumber";
          sync();
        });
        action.addEventListener("change", () => {
          if (action.value === "Slumber") watch.checked = false;
          if (action.value === "Take a Watch") watch.checked = true;
          sync();
        });
        sync();
        slot.append(title, duty, action, hint);
        schedule.append(slot);
      });
      const result = document.createElement("span");
      result.className = "journey-watch-result";
      const perception = context.journey.currentDay?.campPerceptionResults?.find(entry => entry.actorUuid === prior.actorUuid);
      const pendingPerception = context.journey.currentDay?.pendingCampPerceptionRolls?.some(entry => entry.actorUuid === prior.actorUuid);
      const selectedWatch = nightEncounter?.method === "nightDice" ? nightEncounter.encounters.some(entry => entry.watcherActorUuid === prior.actorUuid) : assignedWatchIndexes(prior).includes(Number(nightEncounter?.watchIndex));
      result.textContent = selectedWatch && perception
        ? `Perception ${perception.total} · ${nightOutcomeLabel}`
        : selectedWatch && pendingPerception ? `Waiting for Perception · ${nightOutcomeLabel}`
          : selectedWatch ? `${nightOutcomeLabel} · Perception not requested`
            : nightEncounter && ["minor", "nightAttack"].includes(nightEncounter.outcome) ? "Not the affected watch"
              : nightOutcomeLabel ?? "Night encounter not rolled";
      result.hidden = !nightEncounter || nightEncounter.method === "nightDice";
      row.append(header, schedule, result);
      watches.append(row);
    }
    panel.append(watches);
    const coverage = document.createElement("div");
    coverage.className = "journey-watch-coverage";
    coverage.innerHTML = `<h4>Watch Coverage</h4>${watchCoverage(assignments).map((watcher, watchIndex) => {
      return `<div class="ml-card ml-stack" data-gap="1"><strong>Watch ${watchIndex + 1}</strong><span class="${watcher ?"" : "is-unwatched"}">${watcher ? actorIdentity(watcher) : "Unwatched"}</span></div>`;
    }).join("")}`;
    watches.before(coverage);
    const validation = document.createElement("p");
    validation.className = "ml-callout journey-camp-validation";
    validation.dataset.tone = "danger";
    validation.hidden = true;
    panel.append(validation);
    if (nightEncountersEnabled(context.journey) && !nightEncounter) {
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
    if (night?.method === "nightDice") this.#renderNightDice(panel, context);
    else if (night) {
      const label = { peacefulRest: "Peaceful Rest", uneventful: "Uneventful Night", minor: "Minor Encounter", nightAttack: "Night Attack" }[night.outcome] ?? night.outcome;
      const descriptions = {
        peacefulRest: "The camp remains exceptionally calm. Continue to Sleep & Shelter to confirm each traveler’s rest; this result reduces the sleep DC by 5.",
        uneventful: "No encounter occurs. Continue to Sleep & Shelter to confirm each traveler’s final rest outcome.",
        minor: "A hazard, discovery, or social scene occurs—for example strange tracks, a distressed traveler, unstable ground, or nearby activity. If it becomes combat, record the actual interrupted hours during Sleep & Shelter.",
        nightAttack: "A combat encounter interrupts the selected watch. One interrupted hour is prefilled in Sleep & Shelter; adjust it to the actual duration before rolling."
      };
      const summary = document.createElement("div");
      summary.className = "ml-stack journey-encounter-summary journey-encounter-outcome";
      summary.innerHTML = `<h4>${label}</h4><p>${descriptions[night.outcome] ?? "Resolve the result, then continue to Sleep & Shelter."}</p><p><em>Pending confirmation after Sleep & Shelter.</em></p>`;
      panel.append(summary);
      if (["minor", "nightAttack"].includes(night.outcome)) {
        const interruption = document.createElement("fieldset");
        interruption.className = "ml-field-group journey-night-interruption";
        const currentHours = Number(context.journey.currentDay?.sleepInterruptions?.[0]?.hours ?? (night.outcome === "nightAttack" ? 1 : 0));
        interruption.innerHTML = `<legend>Sleep Interruption</legend><label><span>Hours</span><input type="number" name="nightInterruptionHours" min="0" max="8" step="0.25" value="${currentHours}"></label><small>Enter the actual time the encounter interrupted the night. 2024 rules: count initiative, damage, leveled spells, or at least one hour of exertion. Completed rests are unaffected.</small>`;
                const eventDetails = document.createElement("div");
        eventDetails.className = "ml-grid";
        eventDetails.dataset.columns = "2";
        eventDetails.innerHTML = `<label><span>Rest-interrupting events</span><input type="number" name="nightInterruptionCount" min="0" max="100" step="1" value="${context.journey.currentDay?.sleepInterruptions?.[0]?.count ?? (night.outcome === "nightAttack" ? 1 : 0)}"></label><label><span>Start within the affected watch (hours)</span><input type="number" name="nightInterruptionOffset" min="0" max="2" step="0.25" value="${context.journey.currentDay?.sleepInterruptions?.[0]?.offsetHours ?? 0}"></label>`;
        interruption.append(eventDetails);
        panel.append(interruption);
      }
      panel.append(createOutcomeDetails({ cards: [{ title: "Night Encounter Calculation", rows: [
        { label: "Raw d100", value: night.raw },
        { label: `Danger ${night.danger}`, value: `${night.dangerModifier >= 0 ? "+" : ""}${night.dangerModifier}` },
        ...(night.modifiers ?? []).map(item => ({ label: item.label, value: `${item.value >= 0 ? "+" : ""}${item.value}` })),
        { label: "Final result", value: night.modified },
        { label: "Outcome", value: label },
        { label: "Affected watch roll", value: night.watchRoll },
        { label: "Affected watch", value: Number.isInteger(night.watchIndex) ? campWatchTiming(night.watchIndex) : null },
        { label: "Watch coverage", value: Number.isInteger(night.watchIndex) ? night.unwatched ? "Unwatched — no Perception check is requested" : night.watcherActorName : null, actor: !night.unwatched && night.watcherActorUuid ? { actorUuid: night.watcherActorUuid, name: night.watcherActorName } : null }
      ] }] }));
      if (["minor", "nightAttack"].includes(night.outcome)) {
        panel.append(createEncountersCallout());
      }
    }
    notes.before(panel);
    const syncValidity = () => {
      let message = "";
      try {
        const current = readCampAssignments(this.element, context.journey);
        current.forEach((assignment, index) => {
          const sleep = availableCampSleepHours(current, assignment.actorUuid);
          const needed = Number(context.journey.travelers[index].longRestHours ?? 6);
          const summary = watches.children[index].querySelector(".journey-camp-rest-summary");
          summary.textContent = `${8 - sleep}h awake / ${sleep}h sleep / ${needed}h needed. ${sleep >= needed ? "Enough time for a Long Rest" : "No Long Rest: insufficient sleep"}`;
          summary.dataset.tone = sleep >= needed ? "success" : "warning";
        });
        watchCoverage(current).forEach((watcher, index) => {
          const label = coverage.querySelectorAll("div > span")[index];
          label.innerHTML = watcher ? `${actorIdentity(watcher)}${campWatchAction(watcher, index) === "Take a Watch" ? "" : " (disadvantage)"}` : "Unwatched";
          label.classList.toggle("is-unwatched", !watcher);
        });
      }
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
      if (event.target.matches("select[name^='watchAction'], input[name^='campWatch']")) syncValidity();
    });
    syncValidity();
  }

  #renderNightDice(panel, context) {
    const day = context.journey.currentDay;
    const night = day.nightEncounterCheck;
    const summary = document.createElement("div");
    summary.className = "ml-callout ml-journeys-night-timing";
    summary.dataset.tone = night.encounterCount ? "warning" : "info";
    summary.setAttribute("role", "status");
    summary.innerHTML = '<strong>' + night.encounterCount + ' Night Encounter(s)</strong><p>' + (night.encounterCount ? 'Resolve each encounter below before continuing. The GM chooses combat or non-combat; record actual rest interruptions.' : 'No encounters remain after cancellation. Continue to Sleep & Shelter.') + '</p>';
    panel.prepend(summary);
    if (night.encounters.length) {
      const times = document.createElement("p");
      times.textContent = night.encounters.map(nightEncounterTiming).join("; ");
      summary.append(times);
    }
    for (const encounter of night.encounters) {
      const section = document.createElement("section");
      section.className = "ml-card ml-stack";
      section.dataset.nightEncounterId = encounter.id;
      const saved = day.sleepInterruptions?.find(entry => entry.encounterId === encounter.id);
      const perception = day.campPerceptionResults?.find(entry => entry.watchIndex === encounter.watchIndex);
      const pending = day.pendingCampPerceptionRolls?.find(entry => entry.watchIndex === encounter.watchIndex);
      section.innerHTML = '<h4>' + nightEncounterTiming(encounter) + '</h4><p>' + (encounter.unwatched ? 'Unwatched — no Perception check.' : actorIdentity({ actorUuid: encounter.watcherActorUuid, actorName: encounter.watcherActorName }) + (perception ? ': Perception ' + perception.total : pending ? ': awaiting Perception' : ': Perception not yet requested')) + '</p>';
      if (!encounter.unwatched && !perception) {
        const request = document.createElement("button");
        request.type = "button";
        request.textContent = "Send Perception / GM Roll";
        request.addEventListener("click", async () => {
          request.disabled = true;
          try {
            if (pending) await campPerceptionRollService.resend(pending.id);
            else await campPerceptionRollService.request({ watchIndex: encounter.watchIndex, actorUuid: encounter.watcherActorUuid, action: encounter.campAction });
            await this.render({ force: true });
          } catch (error) { ui.notifications.error(error.message); }
          finally { request.disabled = false; }
        });
        section.append(request);
      }
      const fields = document.createElement("fieldset");
      fields.className = "ml-field-group";
      fields.innerHTML = '<legend>Rest Interruption</legend><div class="ml-grid" data-columns="3"><label><span>Duration (hours)</span><input data-night-hours type="number" min="0" max="8" step="0.25" value="' + (saved?.hours ?? 0) + '"></label><label><span>Rest-breaking events</span><input data-night-count type="number" min="0" max="100" step="1" value="' + (saved?.count ?? 0) + '"></label><label><span>Hours into this period</span><input data-night-offset type="number" min="0" max="' + night.intervalHours + '" step="0.25" value="' + (saved?.offsetHours ?? 0) + '"></label></div><small>Leave zero for an encounter that does not interrupt rest. Enter actual combat or other rest-breaking activity.</small>';
      section.append(fields);
      fields.addEventListener("change", async () => {
        try {
          const current = await getActiveJourney();
          if (current?.id !== context.journey.id || current.dayNumber !== context.journey.dayNumber || current.phase !== "camp") return;
          current.currentDay.sleepInterruptions = readNightInterruptions(panel, current);
          await saveActiveJourney(current);
        } catch (error) { ui.notifications.error(error.message); }
      });
      const open = document.createElement("button");
      open.type = "button";
      open.dataset.action = "openMorelordEncounters";
      open.dataset.nightEncounterId = encounter.id;
      open.textContent = "Open Morelord Encounters";
      section.append(open);
      panel.append(section);
    }
    panel.append(createOutcomeDetails({ cards: [{ title: "Night Encounter Dice", rows: [
      { label: "Danger / die", value: night.danger + " / d" + night.dieFaces },
      { label: "Checks", value: "Every " + night.intervalHours + " hour(s): " + night.results.join(", ") },
      { label: "Encounter results", value: night.campfire ? "1 or 2 (campfire)" : "1" },
      { label: "Triggered", value: night.triggers }, { label: "Cancelled", value: night.cancellations },
      { label: "Maximum cancellation", value: night.dieFaces > 6 ? "Enabled; latest triggered periods cancelled first" : "Disabled on d4 and d6" }
    ] }] }));
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
