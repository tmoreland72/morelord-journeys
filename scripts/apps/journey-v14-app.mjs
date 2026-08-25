import { getEncounterRollMode } from "../core/journey-settings.mjs";
import { automaticDayEncounterModifiers, resolveEncounterRoll } from "../domain/encounter-rules.mjs";
import { MODULE_ID } from "../domain/constants.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { encounterRollService } from "../services/encounter-roll-service.mjs";
import { roleRollService } from "../services/role-roll-service.mjs";
import { JourneyCampApplication as BaseJourneyApplication } from "./journey-camp-app.mjs";
import { createOutcomeDetails } from "../ui/outcome-details.mjs";

const SOCKET = `module.${MODULE_ID}`;
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
    this.#enforceSavedWatches(context);
    if (context.phaseIs?.encounters) this.#renderEncounterControls(context);
  }

  #moveCurrentPhaseToTop() {
    const header = this.element.querySelector(".journey-dashboard-header");
    const phase = this.element.querySelector(".journey-phase-card");
    const navigation = this.element.querySelector(".journey-phases");
    if (header && phase) header.after(phase, ...(navigation ? [navigation] : []));
  }

  #enforceSavedWatches(context) {
    if (!context.phaseIs?.camp) return;
  }

  #renderEncounterControls(context) {
    const panel = this.element.querySelector(".journey-encounter-check");
    if (!panel) return;
    const mode = getEncounterRollMode();
    const gmButton = panel.querySelector("[data-action='rollEncounterChecks']");
    const check = context.journey.currentDay?.encounterCheck;
    if (mode === "players") {
      gmButton?.remove();
      if (!context.journey.currentDay?.pendingEncounterRolls?.length && !check) {
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
      const label = { none: "No Encounter", signs: "Signs & Foreshadowing", minor: "Minor Encounter", major: "Major Encounter" }[check.outcome] ?? check.outcome;
      const descriptions = {
        none: "The road remains quiet. Describe uneventful travel or move directly to the next phase.",
        signs: "Along the path the party could find tracks, smoke, abandoned equipment, distant sounds, frightened travelers, or evidence that something recently passed through.",
        minor: "Present a meaningful choice such as a damaged bridge, curious traveler, localized hazard, useful ruin, animal threat, or brief faction scene. Combat is not required.",
        major: "Present an important event such as a deadly hazard, major discovery, faction confrontation, chase, siege, consequential social scene, or combat. Major describes narrative impact, not encounter type."
      };
      const summary = document.createElement("section");
      summary.className = "journey-encounter-summary";
      summary.innerHTML = `<h3>${label}</h3><p>${descriptions[check.outcome] ?? "Use the modified result to frame the next event along the route."}</p>`;
      const perception = document.createElement("div");
      perception.className = "journey-passive-perception";
      const value = document.createElement("strong");
      value.textContent = `Party Passive Perception: ${check.highestPassivePerception ?? "unknown"}`;
      const help = document.createElement("button");
      help.type = "button";
      help.className = "journey-help-button";
      help.setAttribute("aria-label", "Explain Party Passive Perception");
      help.dataset.tooltip = "Explain Party Passive Perception";
      help.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
      help.addEventListener("click", event => {
        event.preventDefault();
        void foundry.applications.api.DialogV2.prompt({
          window: { title: "Party Passive Perception", icon: "fa-solid fa-circle-question" },
          content: "<div class='ml-journeys-help-content'><p>This is the highest Passive Perception in the traveling party after pace adjustments. Use it when something attempts to remain unnoticed. For a creature encounter, compare the encounter's Stealth check against this value to determine detection and whether surprise may apply. Morelord Encounters can make the opposing Stealth check using the selected creature with the lowest Stealth modifier.</p></div>",
          ok: { label: "Close" }
        });
      });
      perception.append(value, help);
      summary.append(perception);
      panel.append(summary);
      panel.append(createOutcomeDetails({ cards: [{ title: "Day Encounter Calculation", rows: [
        { label: "Raw d100", value: check.raw },
        { label: `Danger ${check.danger}`, value: `${check.dangerModifier >= 0 ? "+" : ""}${check.dangerModifier}` },
        ...(check.modifiers ?? []).map(item => ({ label: item.label, value: `${item.value >= 0 ? "+" : ""}${item.value}` })),
        { label: "Final result", value: check.modified },
        { label: "Outcome", value: label },
        { label: "Party Passive Perception", value: check.highestPassivePerception }
      ] }] }));
      if (["minor", "major"].includes(check.outcome)) {
        const open = document.createElement("button");
        open.type = "button";
        open.dataset.action = "openMorelordEncounters";
        open.className = "journey-open-encounters journey-emphasis-button";
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
      const journey = await getActiveJourney();
      const night = journey?.currentDay?.nightEncounterCheck;
      const watchPerception = night ? journey.currentDay?.campPerceptionResults?.find(result => result.watchIndex === night.watchIndex) : null;
      await api.open({
        source: "morelord-journeys",
        contractVersion: 1,
        journeyId: journey?.id,
        dayNumber: journey?.dayNumber,
        phase: journey?.phase,
        encounterOutcome: night?.outcome ?? journey?.currentDay?.encounterCheck?.outcome,
        detection: night
          ? { mode: "activePerception", total: watchPerception?.total ?? null, actorUuid: night.watcherActorUuid, useLowestCreatureStealth: true }
          : { mode: "passivePerception", total: journey?.currentDay?.encounterCheck?.highestPassivePerception ?? null, useLowestCreatureStealth: true }
      });
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
      await roleRollService.resend();
      ui.notifications.info("The roll request was sent again.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }

  static async requestPlayerEncounterRolls(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      const modifiers = automaticDayEncounterModifiers(journey);
      await encounterRollService.requestPlayers({ modifiers }); await this.render({ force: true });
    }
    catch (error) { ui.notifications.error(error.message); }
  }

  static async rollEncounterChecks(event) {
    event.preventDefault();
    try {
      const journey = await getActiveJourney();
      if (journey.currentDay?.pace === "stopped") throw new Error("Stopped travel does not make a daytime encounter check.");
      const roll = await new Roll("1d100").evaluate();
      const actors = (await Promise.all(journey.travelers.map(traveler => fromUuid(traveler.actorUuid)))).filter(Boolean);
      const passive = actors.map(actor => Number(actor.system?.skills?.prc?.passive ?? 10 + Number(actor.system?.skills?.prc?.total ?? 0)));
      const pacePenalty = journey.currentDay?.pace === "fast" ? -5 : 0;
      const modifiers = automaticDayEncounterModifiers(journey);
      const result = resolveEncounterRoll({ raw: Number(roll.total), danger: journey.routeSnapshot.danger, modifiers });
      journey.currentDay.encounterCheck = { ...result, mode: "gm", highestPassivePerception: (passive.length ? Math.max(...passive) : 0) + pacePenalty, pacePenalty, rolledAt: Date.now() };
      await saveActiveJourney(journey);
      await roll.toMessage({ flavor: `Morelord Journeys daytime encounter — ${result.outcome} (${result.modified})` });
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(error.message); }
  }
}
