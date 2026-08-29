import { automaticDayEncounterModifiers, resolveEncounterRoll } from "../domain/encounter-rules.mjs";
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
      rollEncounterChecks: this.rollEncounterChecks
    }
  };

  #roleRollUpdated = () => {
    if (this.rendered) void this.render({ force: true });
  };

  constructor(options = {}) {
    super(options);
    roleRollService.addEventListener("updated", this.#roleRollUpdated);
  }

  async close(options = {}) {
    roleRollService.removeEventListener("updated", this.#roleRollUpdated);
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
    panel.className = "ml-card ml-stack journey-role-request";
    const title = document.createElement("strong");
    title.textContent = `${role}: ${traveler?.name ?? "Not assigned"}`;
    const detail = document.createElement("p");
    detail.textContent = `${skill} check · DC ${phase === "navigation" ? context.route.navigationDC : context.route.discoveryDC}`;
    panel.append(title, detail);

    if (pending?.phase === phase) {
      const status = document.createElement("p");
      status.className = "journey-roll-pending";
      status.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Waiting for ${pending.actorName}…`;
      const controls = document.createElement("div");
      controls.className = "journey-roll-controls";
      controls.append(button("autoRoleFailure", phase === "navigation" ? "Lost" : "Fail", "fa-xmark"));
      if (phase === "navigation") controls.append(button("autoRoleReversed", "Turned Around", "fa-rotate-left"));
      controls.append(button("autoRoleSuccess", "Succeed", "fa-check"));
      panel.append(status, controls);
    } else if (result) {
      const status = document.createElement("p");
      status.className = "ml-status journey-roll-result";
      const outcomeLabel = phase === "navigation" ? navigationOutcomeLabel(result.outcome) : result.outcome;
      status.dataset.tone = ["success", "shortcut"].includes(result.outcome) ? "success" : "danger";
      status.textContent = phase === "navigation" ? outcomeLabel : `${result.actorName}: ${outcomeLabel}.`;
      panel.append(status, createOutcomeDetails({ cards: [{ title: `${skill} Check`, rows: [
        { label: "Character", value: result.actorName },
        { label: "DC", value: phase === "navigation" ? context.route.navigationDC : context.route.discoveryDC },
        { label: "Roll", value: result.automatic ? "GM resolved manually" : result.total },
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
      const request = button("requestRoleRoll", `Request ${skill} Check`, "fa-dice-d20");
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
    const panel = document.createElement("div");
    panel.className = "ml-card ml-stack journey-encounter-check";
    if (!context.journey.currentDay?.encounterCheck) {
      const roll = button("rollEncounterChecks", "Roll Day Encounter");
      roll.disabled = context.journey.currentDay?.pace === "stopped";
      panel.append(roll);
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

  static async rollEncounterChecks(event) {
    event.preventDefault();
    if (!event.isTrusted) return;
    try {
      const journey = await getActiveJourney();
      if (journey.currentDay?.pace === "stopped") throw new Error("Stopped travel does not make a daytime encounter check.");
      const roll = await new Roll("1d100").evaluate();
      const actors = (await Promise.all(journey.travelers.map(traveler => fromUuid(traveler.actorUuid)))).filter(Boolean);
      const passives = actors.map(actor => Number(actor.system?.skills?.prc?.passive ?? 10 + Number(actor.system?.skills?.prc?.total ?? 0)));
      const pacePenalty = journey.currentDay?.pace === "fast" ? -5 : 0;
      const modifiers = automaticDayEncounterModifiers(journey);
      const result = resolveEncounterRoll({ raw: Number(roll.total), danger: journey.routeSnapshot.danger, modifiers });
      journey.currentDay.encounterCheck = { ...result, highestPassivePerception: (passives.length ? Math.max(...passives) : 0) + pacePenalty, pacePenalty, rolledAt: Date.now() };
      await saveActiveJourney(journey);
      await displayJourneyRoll(roll, { flavor: `Morelord Journeys daytime encounter — ${result.outcome} (${result.modified})`, rollMode: "gmroll" });
      await this.render({ force: true });
    } catch (error) {
      console.error("Morelord Journeys | Encounter checks failed.", error);
      ui.notifications.error(error.message);
    }
  }
}
