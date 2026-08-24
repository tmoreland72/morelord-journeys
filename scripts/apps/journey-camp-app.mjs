import { getEncounterDie } from "../core/journey-settings.mjs";
import { MODULE_ID } from "../domain/constants.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { JourneyActionApplication as BaseJourneyApplication } from "./journey-action-fix-app.mjs";

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
      saveCampPlan: this.saveCampPlan,
      rollCampWatch: this.rollCampWatch
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
    panel.innerHTML = `<header><h3>Watch Order & Camp Actions</h3><p>Assign the party's watches and how each traveler spends that watch. Every watch makes its own encounter check.</p></header>`;
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
      const roll = document.createElement("button");
      roll.type = "button";
      roll.dataset.action = "rollCampWatch";
      roll.dataset.watchIndex = String(index);
      roll.innerHTML = `<i class="fa-solid fa-dice"></i> Roll Watch ${index + 1}`;
      const result = document.createElement("span");
      result.className = "journey-watch-result";
      const perception = context.journey.currentDay?.campPerceptionResults?.find(entry => entry.watchIndex === index);
      const pendingPerception = context.journey.currentDay?.pendingCampPerceptionRolls?.some(entry => entry.watchIndex === index);
      result.textContent = perception
        ? `Perception ${perception.total} · ${prior.encounterRoll?.encounterCount ?? 0} encounter(s)`
        : pendingPerception ? "Waiting for Perception…"
          : prior.encounterRoll ? `${prior.encounterRoll.encounterCount} encounter(s) · Perception not requested` : "Not rolled";
      row.append(heading, member, action, roll, result);
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
    const save = document.createElement("button");
    save.type = "button";
    save.dataset.action = "saveCampPlan";
    save.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Watch Order';
    panel.append(watches, save);
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
      await saveActiveJourney(journey);
      ui.notifications.info("Camp watch order saved.");
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async rollCampWatch(event, target) {
    event.preventDefault();
    try {
      const index = Number(target.dataset.watchIndex);
      const journey = await getActiveJourney();
      if (!journey.currentDay.campWatches?.length) throw new Error("Save the watch order before rolling watches.");
      const danger = Number(journey.routeSnapshot.danger ?? 0);
      const die = getEncounterDie();
      const roll = danger ? await new Roll(`${danger}${die}`).evaluate() : null;
      const results = roll ? roll.dice.flatMap(term => term.results.filter(result => result.active !== false).map(result => result.result)) : [];
      const encounterCount = results.filter(result => result === 1).length;
      journey.currentDay.campWatches[index].encounterRoll = { die, danger, results, encounterCount, rolledAt: Date.now() };
      await saveActiveJourney(journey);
      if (roll) await roll.toMessage({ flavor: `Morelord Journeys — Camp Watch ${index + 1}` });
      await ChatMessage.create({ speaker: { alias: "Morelord Journeys" }, content: `<article class="ml-chat-card ml-journeys-chat-card"><header><i class="fa-solid fa-moon"></i><strong>Watch ${index + 1} Complete</strong></header><p>${encounterCount} encounter${encounterCount === 1 ? "" : "s"} generated during ${journey.currentDay.campWatches[index].actorName}'s watch.</p></article>` });
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }
}
