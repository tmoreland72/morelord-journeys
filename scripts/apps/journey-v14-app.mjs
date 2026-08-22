import { getEncounterDie, getEncounterRollMode } from "../core/journey-settings.mjs";
import { MODULE_ID } from "../domain/constants.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { encounterRollService } from "../services/encounter-roll-service.mjs";
import { EntitlementService } from "../services/entitlement-service.mjs";
import { JourneyCampApplication as BaseJourneyApplication } from "./journey-camp-app.mjs";

const SOCKET = `module.${MODULE_ID}`;
const dieFaces = die => Number(String(die).replace(/^d/, ""));

export class JourneyV14Application extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = {
    actions: {
      resendRoleRoll: this.resendRoleRoll,
      requestPlayerEncounterRolls: this.requestPlayerEncounterRolls,
      rollEncounterChecks: this.rollEncounterChecks,
      openMorelordEncounters: this.openMorelordEncounters
    }
  };

  #encounterUpdated = () => { if (this.rendered) void this.render({ force: true }); };

  constructor(options = {}) {
    super(options);
    encounterRollService.addEventListener("updated", this.#encounterUpdated);
  }

  async close(options = {}) {
    encounterRollService.removeEventListener("updated", this.#encounterUpdated);
    return super.close(options);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#moveCurrentPhaseToTop();
    this.#renderCoreStatus();
    this.#enforceSavedWatches(context);
    if (context.phaseIs?.encounters) this.#renderEncounterControls(context);
  }

  #moveCurrentPhaseToTop() {
    const header = this.element.querySelector(".journey-dashboard-header");
    const phase = this.element.querySelector(".journey-phase-card");
    const navigation = this.element.querySelector(".journey-phases");
    if (header && phase) header.after(phase, ...(navigation ? [navigation] : []));
  }

  #renderCoreStatus() {
    const header = this.element.querySelector(".journey-dashboard-header > div");
    if (!header || header.querySelector(".journey-core-status")) return;
    const status = EntitlementService.status();
    const badge = document.createElement("span");
    badge.className = `journey-core-status ${status.connected ? "connected" : "disconnected"}`;
    badge.innerHTML = `<i class="fa-solid ${status.connected ? "fa-crown" : "fa-link-slash"}"></i> ${status.connected ? `Morelord ${foundry.utils.escapeHTML(status.tier)}` : "Core not connected"}`;
    header.append(badge);
  }

  #enforceSavedWatches(context) {
    if (!context.phaseIs?.camp) return;
    const rows = Array.from(this.element.querySelectorAll(".journey-watch-row"));
    const rolls = rows.map(row => row.querySelector("[data-action='rollCampWatch']"));
    const saved = context.journey.currentDay?.campWatches?.length === rows.length;
    for (const roll of rolls) roll.disabled = !saved;
    const dirty = () => { for (const roll of rolls) roll.disabled = true; };
    for (const row of rows) row.querySelectorAll("select").forEach(select => select.addEventListener("change", dirty));
  }

  #renderEncounterControls(context) {
    const panel = this.element.querySelector(".journey-encounter-check");
    if (!panel) return;
    const mode = getEncounterRollMode();
    const gmButton = panel.querySelector("[data-action='rollEncounterChecks']");
    const check = context.journey.currentDay?.encounterCheck;
    if (mode === "players") {
      gmButton?.remove();
      if (!context.journey.currentDay?.pendingEncounterRolls?.length && !check?.results?.length) {
        const request = document.createElement("button");
        request.type = "button";
        request.dataset.action = "requestPlayerEncounterRolls";
        request.innerHTML = '<i class="fa-solid fa-users"></i> Request Player Encounter Rolls';
        panel.append(request);
      }
      const pending = context.journey.currentDay?.pendingEncounterRolls ?? [];
      if (pending.length) {
        const status = document.createElement("p");
        status.className = "journey-roll-pending";
        status.textContent = `Waiting for ${pending.map(request => request.actorName).join(", ")}…`;
        panel.append(status);
      }
    }
    if (check) {
      const summary = document.createElement("p");
      summary.className = "journey-encounter-summary";
      summary.innerHTML = `<strong>${check.encounterCount ?? 0} complications</strong> · <strong>${check.boonCount ?? 0} boons</strong>`;
      panel.append(summary);
      if (Number(check.encounterCount ?? 0) > 0) {
        const open = document.createElement("button");
        open.type = "button";
        open.dataset.action = "openMorelordEncounters";
        open.className = "journey-open-encounters";
        open.innerHTML = '<i class="fa-solid fa-hydra"></i> Open Morelord Encounters';
        panel.append(open);
      }
      const input = this.element.querySelector("[name='encounterCount']");
      if (input) input.value = check.encounterCount ?? 0;
    }
  }

  static async openMorelordEncounters(event) {
    event.preventDefault();
    const encountersModule = game.modules.get("morelord-encounters");
    if (!encountersModule) {
      ui.notifications.warn(
        "Morelord Encounters is recommended for building triggered encounters. Install it from Foundry's Add-on Modules setup screen, then enable it in this world.",
        { permanent: true }
      );
      return;
    }
    if (!encountersModule.active) {
      ui.notifications.warn("Morelord Encounters is installed but disabled. Enable it in Manage Modules to build the triggered encounter.");
      return;
    }

    const api = encountersModule.api ?? globalThis.MorelordEncounters;
    if (typeof api?.open === "function") {
      await api.open();
      return;
    }

    const tool = ui.controls?.controls?.tokens?.tools?.morelordEncounters;
    if (typeof tool?.onChange === "function") {
      await tool.onChange(true);
      return;
    }

    const button = document.querySelector('[data-tool="morelordEncounters"]');
    if (button) {
      button.click();
      return;
    }
    ui.notifications.warn("Morelord Encounters is active but does not expose an open action. Reload Foundry and try again.");
  }

  static async resendRoleRoll(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      const request = journey?.currentDay?.pendingRoleRoll;
      if (!request) throw new Error("There is no pending role check to resend.");
      const oldId = request.id;
      request.id = crypto.randomUUID();
      request.resentAt = Date.now();
      request.resendCount = (request.resendCount ?? 0) + 1;
      await saveActiveJourney(journey);
      game.socket.emit(SOCKET, { type: "roleRoll.resolved", requestId: oldId });
      game.socket.emit(SOCKET, { type: "roleRoll.request", request });
      ui.notifications.info(`A new roll request was sent to ${request.actorName}.`);
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async requestPlayerEncounterRolls(event) {
    event.preventDefault();
    try { await encounterRollService.requestPlayers(); await this.render({ force: true }); }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async rollEncounterChecks(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      const danger = Number(journey.routeSnapshot.danger ?? 0);
      const die = getEncounterDie();
      const roll = danger ? await new Roll(`${danger}${die}`).evaluate() : null;
      const results = roll ? roll.dice.flatMap(term => term.results.filter(result => result.active !== false).map(result => result.result)) : [];
      const encounterCount = results.filter(result => result === 1).length;
      const boonCount = results.filter(result => result === dieFaces(die)).length;
      journey.currentDay.encounterCheck = { die, danger, mode: "gm", results, encounterCount, boonCount, rolledAt: Date.now() };
      await saveActiveJourney(journey);
      if (roll) await roll.toMessage({ flavor: `Morelord Journeys encounter checks — ${encounterCount} complications, ${boonCount} boons` });
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }
}
