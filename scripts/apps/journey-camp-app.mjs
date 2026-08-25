import { nightEncountersEnabled } from "../core/journey-settings.mjs";
import { MODULE_ID } from "../domain/constants.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { JourneyActionApplication as BaseJourneyApplication } from "./journey-action-fix-app.mjs";
import { createOutcomeDetails } from "../ui/outcome-details.mjs";

const SOCKET = `module.${MODULE_ID}`;
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
    const panel = document.createElement("section");
    panel.className = "ml-journeys-panel journey-card journey-camp-planner";
    panel.innerHTML = `<header><h3>Watch Order & Camp Actions</h3><p>Assignments save automatically. Anyone not assigned to Take a Watch receives the same rest treatment as Slumber.</p></header><div><label class="journey-check"><input type="checkbox" name="campfire" ${context.journey.currentDay?.campfire ? "checked" : ""}><span>Camp has a visible fire</span></label><button type="button" class="journey-help-button" data-campfire-help aria-label="Explain campfire effects" data-tooltip="Explain campfire effects"><i class="fa-solid fa-circle-question"></i></button></div>`;
    panel.querySelector("[data-campfire-help]").addEventListener("click", event => {
      event.preventDefault();
      void foundry.applications.api.DialogV2.prompt({ window: { title: "Campfire Effects", icon: "fa-solid fa-circle-question" }, content: "<div class='ml-journeys-help-content'><p>Craft, Cook, and Prepare require a fire. A fire marks excellent setup (-10) while its visibility adds +5 to the night encounter check, for a net -5. No fire and no tents marks poor setup (+10).</p></div>", ok: { label: "Close" } });
    });
    const watches = document.createElement("div");
    watches.className = "journey-watch-list";
    for (let index = 0; index < 4; index += 1) {
      const prior = saved[index] ?? {};
      const row = document.createElement("div");
      row.className = "journey-watch-row";
      row.dataset.watchIndex = String(index);
      const heading = document.createElement("strong");
      heading.textContent = `Watch ${index + 1}`;
      const member = document.createElement("select");
      member.name = `watchMember${index}`;
      member.append(option("", "Unassigned", prior.actorUuid ?? ""));
      for (const traveler of context.journey.travelers) member.append(option(traveler.actorUuid, traveler.name, prior.actorUuid));
      const action = document.createElement("select");
      action.name = `watchAction${index}`;
      for (const name of CAMP_ACTIONS) action.append(option(name, name, prior.action ?? "Take a Watch"));
      const result = document.createElement("span");
      result.className = "journey-watch-result";
      const perception = context.journey.currentDay?.campPerceptionResults?.find(entry => entry.watchIndex === index);
      const pendingPerception = context.journey.currentDay?.pendingCampPerceptionRolls?.some(entry => entry.watchIndex === index);
      result.textContent = perception
        ? `Perception ${perception.total} · ${prior.encounterRoll?.encounterCount ?? 0} encounter(s)`
        : pendingPerception ? "Waiting for Perception…"
          : prior.encounterRoll ? `${prior.encounterRoll.encounterCount} encounter(s) · Perception not requested` : "Not rolled";
      row.append(heading, member, action, result);
      if (Number(prior.encounterRoll?.encounterCount ?? 0) > 0) {
        const open = document.createElement("button");
        open.type = "button";
        open.dataset.action = "openMorelordEncounters";
        open.className = "journey-emphasis-button";
        open.innerHTML = '<i class="fa-solid fa-hydra"></i> Open Encounters';
        row.append(open);
      }
      watches.append(row);
    }
    panel.append(watches);
    if (nightEncountersEnabled()) {
      const rollNight = document.createElement("button");
      rollNight.type = "button";
      rollNight.dataset.action = "rollNightEncounter";
      rollNight.textContent = "Roll Night Encounter";
      const nightHelp = document.createElement("button");
      nightHelp.type = "button";
      nightHelp.className = "journey-help-button";
      nightHelp.dataset.action = "showNightEncounterOutcomes";
      nightHelp.setAttribute("aria-label", "Explain night encounter outcomes");
      nightHelp.dataset.tooltip = "Explain night encounter outcomes";
      nightHelp.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
      const nightControls = document.createElement("div");
      nightControls.className = "journey-inline-actions journey-night-controls";
      nightControls.append(rollNight, nightHelp);
      panel.append(nightControls);
    }
    const night = context.journey.currentDay?.nightEncounterCheck;
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
      panel.append(createOutcomeDetails({ cards: [{ title: "Night Encounter Calculation", rows: [
        { label: "Raw d100", value: night.raw },
        { label: `Danger ${night.danger}`, value: `${night.dangerModifier >= 0 ? "+" : ""}${night.dangerModifier}` },
        ...(night.modifiers ?? []).map(item => ({ label: item.label, value: `${item.value >= 0 ? "+" : ""}${item.value}` })),
        { label: "Final result", value: night.modified },
        { label: "Outcome", value: label },
        { label: "Affected watch roll", value: night.watchRoll },
        { label: "Affected watch", value: Number.isInteger(night.watchIndex) ? `Watch ${night.watchIndex + 1}` : null }
      ] }] }));
      if (["minor", "nightAttack"].includes(night.outcome)) {
        const open = document.createElement("button");
        open.type = "button";
        open.dataset.action = "openMorelordEncounters";
        open.className = "journey-open-encounters journey-emphasis-button";
        open.innerHTML = '<i class="fa-solid fa-hydra"></i> Open Morelord Encounters';
        panel.append(open);
      }
    }
    notes.before(panel);
  }

  static async resendRoleRoll(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      const request = journey?.currentDay?.pendingRoleRoll;
      if (!request) throw new Error("There is no pending role check to resend.");
      request.resentAt = Date.now();
      request.resendCount = (request.resendCount ?? 0) + 1;
      await saveActiveJourney(journey);
      game.socket.emit(SOCKET, { type: "roleRoll.request", request });
      ui.notifications.info(`Roll request sent again to ${request.actorName}.`);
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async saveCampPlan(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      journey.currentDay.campWatches = Array.from({ length: 4 }, (_, index) => {
        const actorUuid = this.element.querySelector(`[name='watchMember${index}']`)?.value ?? "";
        const traveler = journey.travelers.find(entry => entry.actorUuid === actorUuid);
        const prior = journey.currentDay.campWatches?.[index];
        return { index, actorUuid, actorName: traveler?.name ?? "Unassigned", action: this.element.querySelector(`[name='watchAction${index}']`)?.value ?? "Take a Watch", encounterRoll: prior?.encounterRoll ?? null };
      });
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
