import { dayEncounterService } from "../services/day-encounter-service.mjs";
import { actorIdentity } from "../../../morelord-core/scripts/ui/actor-identity.js";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { roleRollService } from "../services/role-roll-service.mjs";
import { JourneyRouteSelectApplication as BaseJourneyApplication } from "./journey-route-select-app.mjs";
import { createOutcomeDetails } from "../ui/outcome-details.mjs";
import { navigationOutcomeLabel } from "../domain/navigation-rules.mjs";
import { displayJourneyRoll } from "../ui/journey-roll-display.mjs";

function button(action, label, icon = null) {
  const element = document.createElement("button");
  element.type = "button";
  element.dataset.action = action;
  if (icon) {
    const glyph = document.createElement("i");
    glyph.className = `fa-solid ${icon}`;
    element.append(glyph, " ");
  }
  element.append(label);
  return element;
}

export class JourneyOrchestrationApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = {
    actions: {
      requestRoleRoll: this.requestRoleRoll,
      autoRoleSuccess: this.autoRoleSuccess,
      autoRoleFailure: this.autoRoleFailure,
      autoRoleReversed: this.autoRoleReversed,
      rollEncounterChecks: this.rollEncounterChecks,
      resendDayEncounter: this.resendDayEncounter
    }
  };

  #roleRollUpdated = () => {
    if (this.rendered) void this.render({ force: true });
  };

  constructor(options = {}) {
    super(options);
    roleRollService.addEventListener("updated", this.#roleRollUpdated);
    dayEncounterService.addEventListener("updated", this.#roleRollUpdated);
  }

  async close(options = {}) {
    roleRollService.removeEventListener("updated", this.#roleRollUpdated);
    dayEncounterService.removeEventListener("updated", this.#roleRollUpdated);
    return super.close(options);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!context.hasJourney) return;
    if (context.phaseIs?.discovery || context.phaseIs?.navigation) this.#renderRoleCheck(context);
    if (context.phaseIs?.encounters) this.#renderEncounterCheck(context);
  }

  #renderRoleCheck(context) {
    const timeHelp = this.element.querySelector("[data-discovery-time-help]");
    if (timeHelp && timeHelp.dataset.bound !== "true") {
      timeHelp.dataset.bound = "true";
      timeHelp.addEventListener("click", event => {
        event.preventDefault();
        void foundry.applications.api.DialogV2.prompt({
          window: { title: "Discovery Time Cost", icon: "fa-solid fa-circle-question" },
      content: "<div class='ml-journeys-help-content'><section><h3>Investigating</h3><ul><li>Close Journeys.</li><li>Run the discovery.</li><li>Reopen Journeys when travel resumes.</li></ul></section><section><h3>Time Cost</h3><ul><li>Record actual elapsed days and thirds.</li><li>Use zero if ignored or the check failed.</li></ul></section></div>",
          ok: { label: "Close" }
        });
      });
    }
    this.element.querySelector(".journey-navigator-panel")?.remove();
    const phase = context.journey.phase;
    const anchor = phase === "navigation"
      ? this.element.querySelector("[data-navigation-result]")
      : this.element.querySelector("[name='discoveryCostDays']")?.closest("label");
    if (!anchor) return;
    const role = phase === "navigation" ? "Navigator" : "Observer";
    const skill = phase === "navigation" ? "Survival" : "Perception";
    const actorUuid = context.journey.roles?.[`${role.toLowerCase()}Uuid`];
    const traveler = context.journey.travelers.find(entry => entry.actorUuid === actorUuid);
    const pending = roleRollService.getPending(context.journey);
    const result = roleRollService.getResult(context.journey, phase);
    const panel = document.createElement("div");
    panel.className = "ml-stack journey-role-request";
    const title = document.createElement("strong");
    title.innerHTML = `${role}: ${traveler ? actorIdentity(traveler) : "Not assigned"}`;
    const detail = document.createElement("p");
    const dc = phase === "navigation" ? context.route.navigationDC : context.route.discoveryDC;
    detail.textContent = `${skill} check · DC ${dc}${dc === 0 ? " · No roll needed" : ""}`;
    panel.append(title, detail);

    if (pending?.phase === phase) {
      const status = document.createElement("p");
      status.className = "journey-roll-pending";
      status.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Waiting for ${actorIdentity(pending)}…`;
      const controls = document.createElement("div");
      controls.className = "ml-cluster journey-roll-controls";
      controls.append(button("autoRoleFailure", phase === "navigation" ? "Lost" : "Fail", "fa-xmark"));
      if (phase === "navigation") controls.append(button("autoRoleReversed", "Turned Around", "fa-rotate-left"));
      controls.append(button("autoRoleSuccess", "Succeed", "fa-check"));
      panel.append(status, controls);
    } else if (result) {
      const status = document.createElement("p");
      status.className = "ml-status journey-roll-result";
      const outcomeLabel = phase === "navigation" ? navigationOutcomeLabel(result.outcome) : result.outcome;
      status.dataset.tone = ["success", "shortcut"].includes(result.outcome) ? "success" : "danger";
      status.innerHTML = phase === "navigation" ? foundry.utils.escapeHTML(outcomeLabel) : `${actorIdentity(result)}: ${foundry.utils.escapeHTML(outcomeLabel)}.`;
      panel.append(status, createOutcomeDetails({ cards: [{ title: `${skill} Check`, rows: [
        { label: "Character", value: result.actorName, actor: result },
        { label: "DC", value: phase === "navigation" ? context.route.navigationDC : context.route.discoveryDC },
        { label: "Roll", value: result.automaticReason === "zeroDC" ? "DC 0 — no roll needed" : result.automatic ? "GM resolved manually" : result.total },
        { label: "Natural d20", value: result.automatic ? null : result.natural },
        { label: "Outcome", value: outcomeLabel }
      ] }] }));
      if (phase !== "navigation") {
        const days = this.element.querySelector("[name='discoveryCostDays']");
        const thirds = this.element.querySelector("[name='discoveryCostThirds']");
        if (result.outcome !== "success") {
          days.value = "0";
          thirds.value = "0";
          days.disabled = true;
          thirds.disabled = true;
          days.dataset.tooltip = "A failed discovery check reveals no lead and costs no time.";
        }
      }
    } else {
      const request = button("requestRoleRoll", dc === 0 ? "Resolve Automatic Success" : `Request ${skill} Check`, dc === 0 ? "fa-check" : "fa-dice-d20");
      request.disabled = !traveler;
      panel.append(request);
    }
    if (phase === "discovery") {
      const costs = this.element.querySelector(".journey-discovery-cost");
      costs?.before(panel);
      const lead = this.element.querySelector(".journey-discovery-lead");
      if (lead) panel.after(lead);
    } else anchor.replaceWith(panel);
  }

  #renderEncounterCheck(context) {
    const anchor = this.element.querySelector(".journey-phase-card > [data-action='advancePhase']");
    if (!anchor) return;
    anchor.disabled = !game.user.isGM || (!context.journey.currentDay?.encounterCheck && context.route.danger > 0);
    const panel = document.createElement("div");
    panel.className = "ml-stack journey-encounter-check";
    if (!context.journey.currentDay?.encounterCheck && !context.journey.currentDay?.pendingDayEncounterRolls?.length) {
      const roll = button("rollEncounterChecks", context.route.danger === 0 ? "Confirm No Day Encounters" : "Request Party Day Encounter Rolls");
      roll.disabled = !game.user.isGM;
      roll.disabled ||= context.journey.currentDay?.pace === "stopped";
      panel.append(roll);
    }
    if (game.user.isGM) for (const request of context.journey.currentDay?.pendingDayEncounterRolls ?? []) {
      const row = document.createElement("div");
      row.className = "ml-item-row";
      const copy = document.createElement("div");
      copy.className = "ml-stack";
      copy.innerHTML = actorIdentity(request);
      const note = document.createElement("small");
      note.textContent = `Awaiting ${request.checks}d${request.dieFaces} — results visible only to GMs`;
      copy.append(note);
      const resend = button("resendDayEncounter", "Resend");
      resend.dataset.requestId = request.id;
      row.append(copy, resend);
      panel.append(row);
    }
    anchor.before(panel);
  }

  static async requestRoleRoll(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      await roleRollService.request({ phase: journey.phase });
      await this.render({ force: true });
    } catch (error) {
      console.error("Morelord Journeys | Role check request failed.", error);
      ui.notifications.error(error.message);
    }
  }

  static async autoRoleSuccess(event) {
    event.preventDefault();
    await this.#autoResolve(true);
  }

  static async autoRoleFailure(event) {
    event.preventDefault();
    await this.#autoResolve(false);
  }

  static async autoRoleReversed(event) {
    event.preventDefault();
    try { await roleRollService.autoResolveOutcome("reversed"); await this.render({ force: true }); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async #autoResolve(succeeded) {
    try {
      await roleRollService.autoResolve(succeeded);
      await this.render({ force: true });
    } catch (error) {
      console.error("Morelord Journeys | Automatic role check resolution failed.", error);
      ui.notifications.error(error.message);
    }
  }

  static async rollEncounterChecks(event, target) {
    event.preventDefault();
    if (target) target.disabled = true;
    try {
      await dayEncounterService.requestParty();
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
    finally { if (target) target.disabled = false; }
  }

  static async resendDayEncounter(event, target) {
    event.preventDefault();
    try { await dayEncounterService.resend(target.dataset.requestId); }
    catch (error) { ui.notifications.error(error.message); }
  }
}
