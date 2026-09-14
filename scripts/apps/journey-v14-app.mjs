import { getActiveJourney } from "../foundry/settings-repository.mjs";
import { roleRollService } from "../services/role-roll-service.mjs";
import { JourneyCampApplication as BaseJourneyApplication } from "./journey-camp-app.mjs";
import { createOutcomeDetails } from "../ui/outcome-details.mjs";
import { primaryActionSelectors, setPrimaryAction } from "../ui/primary-action.mjs";
import { createEncountersCallout } from "../ui/encounters-callout.mjs";
import { preparePlannerSections } from "../ui/planner-sections.mjs";

export class JourneyV14Application extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = {
    actions: {
      resendRoleRoll: this.resendRoleRoll,
      openMorelordEncounters: this.openMorelordEncounters
    }
  };

  #primaryActionObserver = null;

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!context.hasJourney) preparePlannerSections(this.element);
    this.#moveCurrentPhaseToTop();
    this.#enforceSavedWatches(context);
    if (context.phaseIs?.encounters) this.#renderEncounterControls(context);
    this.#watchPrimaryAction(context);
  }

  async close(options = {}) {
    this.#primaryActionObserver?.disconnect();
    return super.close(options);
  }

  #watchPrimaryAction(context) {
    this.#primaryActionObserver?.disconnect();
    const sync = () => setPrimaryAction(this.element, primaryActionSelectors(context));
    sync();
    this.#primaryActionObserver = new MutationObserver(sync);
    this.#primaryActionObserver.observe(this.element, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden"] });
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
    if (!game.user.isGM) return;
    const panel = this.element.querySelector(".journey-encounter-check");
    if (!panel) return;
    const check = context.journey.currentDay?.encounterCheck;
    if (check) {
      const label = check.method === "partyDice" ? (check.encounterCount ? `${check.encounterCount} Encounter${check.encounterCount === 1 ? "" : "s"}` : "No Encounters") : { none: "No Encounter", signs: "Signs & Foreshadowing", minor: "Minor Encounter", major: "Major Encounter" }[check.outcome] ?? check.outcome;
      const descriptions = {
        none: "The road remains quiet. Describe uneventful travel or move directly to the next phase.",
        signs: "Along the path the party could find tracks, smoke, abandoned equipment, distant sounds, frightened travelers, or evidence that something recently passed through.",
        minor: "Present a meaningful choice such as a damaged bridge, curious traveler, localized hazard, useful ruin, animal threat, or brief faction scene. Combat is not required.",
        major: "Present an important event such as a deadly hazard, major discovery, faction confrontation, chase, siege, consequential social scene, or combat. Major describes narrative impact, not encounter type."
      };
      const summary = document.createElement("section");
      summary.className = "ml-stack journey-encounter-summary";
      summary.innerHTML = `<h3>${label}</h3><p>${check.method === "partyDice" ? "Each 1 adds an encounter; each maximum result cancels one across the party. Resolve the remaining encounters before continuing." : descriptions[check.outcome] ?? "Use the modified result to frame the next event along the route."}</p>`;
      const perception = document.createElement("div");
      perception.className = "journey-passive-perception";
      const value = document.createElement("strong");
      value.textContent = `Party Passive Perception: ${check.highestPassivePerception ?? "unknown"}`;
      const help = document.createElement("button");
      help.type = "button";
      help.className = "ml-icon-button journey-help-button";
      help.dataset.size = "compact";
      help.dataset.variant = "ghost";
      help.setAttribute("aria-label", "Explain Party Passive Perception");
      help.dataset.tooltip = "Explain Party Passive Perception";
      help.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
      help.addEventListener("click", event => {
        event.preventDefault();
        void foundry.applications.api.DialogV2.prompt({
          window: { title: "Party Passive Perception", icon: "fa-solid fa-circle-question" },
        content: "<div class='ml-journeys-help-content'><section><h3>Value</h3><ul><li>Highest party Passive Perception.</li><li>Includes the travel-pace adjustment.</li></ul></section><section><h3>Use</h3><ul><li>Compare against opposing Stealth.</li><li>Use the result for detection or surprise.</li><li>Morelord Encounters can roll the lowest selected creature Stealth.</li></ul></section></div>",
          ok: { label: "Close" }
        });
      });
      perception.append(value, help);
      summary.append(perception);
      panel.append(summary);
      if (["minor", "major", "encounter"].includes(check.outcome)) {
        const delay = document.createElement("fieldset");
        delay.className = "ml-field-group journey-encounter-delay";
        delay.innerHTML = `<legend>Time Delay <button type="button" class="ml-icon-button journey-help-button" data-size="compact" data-variant="ghost" aria-label="Explain encounter time delay" data-tooltip="Explain encounter time delay"><i class="fa-solid fa-circle-question"></i></button></legend><div class="ml-field-group__controls"><label><span>Days</span><input name="encounterDelayDays" type="number" min="0" step="1" value="0"></label><label><span>Thirds</span><select name="encounterDelayThirds"><option value="0">0</option><option value="1">⅓</option><option value="2">⅔</option></select></label></div>`;
        delay.querySelector("button").addEventListener("click", event => {
          event.preventDefault();
          void foundry.applications.api.DialogV2.prompt({
            window: { title: "Encounter Time Delay", icon: "fa-solid fa-circle-question" },
        content: "<div class='ml-journeys-help-content'><section><h3>Record</h3><ul><li>Enter actual travel time lost.</li><li>Include diversions, recovery, negotiation, or investigation.</li><li>Use zero for no meaningful delay.</li></ul></section></div>",
            ok: { label: "Close" }
          });
        });
        panel.append(delay);
      }
      panel.append(createOutcomeDetails({ cards: check.method === "partyDice" ? [{ title: "Day Encounter Checks", rows: [
        { label: "Checks per traveler", value: check.danger },
        { label: "Die", value: `d${check.dieFaces}` },
        { label: "Total dice", value: check.totalRolls },
        { label: "Ones", value: check.ones },
        { label: "Maximum results", value: check.maximums },
        { label: "Encounters", value: check.encounterCount }
      ] }, ...check.travelerRolls.map(traveler => ({ actor: traveler, rows: [{ label: "Dice", value: traveler.results.join(", ") || "No checks" }] }))] : [{ title: "Day Encounter Calculation", rows: [
        { label: "Raw d100", value: check.raw },
        { label: `Danger ${check.danger}`, value: `${check.dangerModifier >= 0 ? "+" : ""}${check.dangerModifier}` },
        ...(check.modifiers ?? []).map(item => ({ label: item.label, value: `${item.value >= 0 ? "+" : ""}${item.value}` })),
        { label: "Final result", value: check.modified },
        { label: "Outcome", value: label },
        { label: "Party Passive Perception", value: check.highestPassivePerception }
      ] }] }));
      if (["minor", "major", "encounter"].includes(check.outcome)) {
        panel.append(createEncountersCallout());
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
        encounterCount: journey?.currentDay?.encounterCheck?.encounterCount ?? 0,
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

}
