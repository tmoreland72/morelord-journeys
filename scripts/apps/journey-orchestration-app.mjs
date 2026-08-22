import { getEncounterDie } from "../core/journey-settings.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { roleRollService } from "../services/role-roll-service.mjs";
import { JourneyRouteSelectApplication as BaseJourneyApplication } from "./journey-route-select-app.mjs";

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
    this.element.querySelector(".journey-navigator-panel")?.remove();
    const phase = context.journey.phase;
    const anchorName = phase === "navigation" ? "navigationOutcome" : "pursueDiscovery";
    const anchor = this.element.querySelector(`[name='${anchorName}']`)?.closest("label");
    if (!anchor) return;
    const role = phase === "navigation" ? "Navigator" : "Observer";
    const skill = phase === "navigation" ? "Survival" : "Perception";
    const actorUuid = context.journey.roles?.[`${role.toLowerCase()}Uuid`];
    const traveler = context.journey.travelers.find(entry => entry.actorUuid === actorUuid);
    const pending = roleRollService.getPending(context.journey);
    const result = roleRollService.getResult(context.journey, phase);
    const panel = document.createElement("div");
    panel.className = "ml-journeys-panel journey-card journey-role-request";
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
      controls.append(button("autoRoleFailure", "Auto Fail", "fa-xmark"), button("autoRoleSuccess", "Auto Succeed", "fa-check"));
      panel.append(status, controls);
    } else if (result) {
      const status = document.createElement("p");
      status.className = `journey-roll-result ${result.outcome}`;
      const total = result.automatic ? "GM resolved" : `rolled ${result.total}`;
      status.textContent = `${result.actorName} ${total}: ${result.outcome}.`;
      panel.append(status);
      if (phase === "navigation") this.element.querySelector("[name='navigationOutcome']").value = result.outcome;
    } else {
      const request = button("requestRoleRoll", `Request ${skill} Check`, "fa-dice-d20");
      request.disabled = !traveler;
      panel.append(request);
    }
    anchor.before(panel);
  }

  #renderEncounterCheck(context) {
    const input = this.element.querySelector("[name='encounterCount']");
    const anchor = input?.closest("label");
    if (!anchor) return;
    const die = getEncounterDie();
    const danger = Number(context.route.danger ?? 0);
    const prior = context.journey.currentDay?.encounterCheck;
    if (prior) input.value = prior.encounterCount;
    const panel = document.createElement("div");
    panel.className = "ml-journeys-panel journey-card journey-encounter-check";
    const detail = document.createElement("p");
    detail.textContent = danger
      ? `Danger ${danger} rolls ${danger}${die}. Each die showing 1 creates an encounter.`
      : "This route has no encounter checks.";
    const roll = button("rollEncounterChecks", `Roll ${danger}${die}`, "fa-dice");
    roll.disabled = danger === 0;
    panel.append(detail, roll);
    if (prior) {
      const result = document.createElement("strong");
      result.textContent = `${prior.encounterCount} encounter${prior.encounterCount === 1 ? "" : "s"} generated.`;
      panel.append(result);
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
    try {
      const journey = await getActiveJourney();
      const danger = Number(journey.routeSnapshot.danger ?? 0);
      const die = getEncounterDie();
      if (!danger) return;
      const roll = await new Roll(`${danger}${die}`).evaluate();
      const results = roll.dice.flatMap(term => term.results.filter(result => result.active !== false).map(result => result.result));
      const encounterCount = results.filter(result => result === 1).length;
      journey.currentDay.encounterCheck = { die, danger, results, encounterCount, rolledAt: Date.now() };
      await saveActiveJourney(journey);
      await roll.toMessage({ flavor: `Morelord Journeys encounter checks — Danger ${danger}` });
      await this.render({ force: true });
    } catch (error) {
      console.error("Morelord Journeys | Encounter checks failed.", error);
      ui.notifications.error(error.message);
    }
  }
}
