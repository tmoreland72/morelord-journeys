import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { getDayEncounterDie } from "../core/journey-settings.mjs";
import { resolveDayEncounterChecks } from "../domain/encounter-rules.mjs";
import { getMorelordSocketChannel, JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";
import { requestRecipientForActor, activeGM } from "./client-request-routing-service.mjs";
import { actorIdentity } from "../../../morelord-core/scripts/ui/actor-identity.js";
import { clientRollButton } from "../ui/client-roll-dialog.mjs";
import { displayJourneyRoll } from "../ui/journey-roll-display.mjs";

class DayEncounterService extends EventTarget {
  #channel;
  #dialogs = new Map();

  start() {
    if (this.#channel) return;
    this.#channel = getMorelordSocketChannel();
    globalThis.Hooks?.on("updateSetting", setting => {
      if (game.user.isGM && setting.key === "morelord-journeys.activeJourney") this.dispatchEvent(new Event("updated"));
    });
    this.#channel.on("dayEncounter.requestParty", (_data, execution) => this.#requestParty(execution), { serialize: JOURNEY_STATE_SERIAL_KEY });
    this.#channel.on("dayEncounter.resend", (data, execution) => this.#resend(data.requestId, execution), { serialize: JOURNEY_STATE_SERIAL_KEY });
    this.#channel.on("dayEncounter.roll", (data, execution) => this.#roll(data.requestId, execution), { serialize: JOURNEY_STATE_SERIAL_KEY });
    this.#channel.on("dayEncounter.request", ({ request }, execution) => {
      if (game.users.get(execution.senderUserId)?.isGM && request.userId === game.user.id) return this.#open(request);
    });
  }

  async requestParty() {
    if (!game.user.isGM) throw new Error("Only a GM may request daytime encounters.");
    return this.#channel.executeAsUser("dayEncounter.requestParty", {}, activeGM()?.id ?? game.user.id);
  }

  async #requestParty(execution) {
    if (!game.user.isGM || !game.users.get(execution.senderUserId)?.isGM) throw new Error("Only a GM may request daytime encounters.");
    const journey = await getActiveJourney();
    if (journey?.phase !== "encounters") throw new Error("The journey is not in Day Encounters.");
    if (journey.currentDay.encounterCheck || journey.currentDay.pendingDayEncounterRolls?.length) throw new Error("Daytime checks have already been requested or resolved.");
    if (journey.currentDay.pace === "stopped") throw new Error("Stopped travel does not make daytime encounter checks.");
    if (!journey.travelers.length) throw new Error("The journey has no travelers.");
    const checks = Number(journey.routeSnapshot.danger);
    const dieFaces = getDayEncounterDie();
    resolveDayEncounterChecks({ danger: checks, dieFaces, travelerRolls: [] });
    const requests = [];
    if (checks > 0) for (const traveler of journey.travelers) {
      const actor = await fromUuid(traveler.actorUuid);
      if (!actor) throw new Error(`${traveler.name}'s actor is unavailable.`);
      const recipient = requestRecipientForActor(actor);
      if (!recipient) throw new Error(`No active user can roll for ${traveler.name}.`);
      requests.push({ id: crypto.randomUUID(), journeyId: journey.id, dayNumber: journey.dayNumber,
        actorUuid: traveler.actorUuid, actorName: traveler.name, userId: recipient.user.id, checks, dieFaces });
    }
    journey.currentDay.pendingDayEncounterRolls = requests;
    journey.currentDay.dayEncounterResults = [];
    if (!checks) journey.currentDay.encounterCheck = resolveDayEncounterChecks({ danger: 0, dieFaces, travelerRolls: [] });
    await saveActiveJourney(journey);
    this.dispatchEvent(new Event("updated"));
    for (const request of requests) await this.#send(request);
    return { accepted: true };
  }

  async #send(request) {
    if (request.userId === game.user.id) return this.#open(request);
    return this.#channel.executeAsUser("dayEncounter.request", { request }, request.userId);
  }

  async resend(requestId) {
    if (!game.user.isGM) throw new Error("Only a GM may resend encounter requests.");
    return this.#channel.executeAsUser("dayEncounter.resend", { requestId }, activeGM()?.id ?? game.user.id);
  }

  async #resend(requestId, execution) {
    if (!game.user.isGM || !game.users.get(execution.senderUserId)?.isGM) throw new Error("Only a GM may resend encounter requests.");
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingDayEncounterRolls?.find(item => item.id === requestId);
    if (!request) throw new Error("That encounter request is no longer pending.");
    // Preserve the request's assigned user while active; reconnecting players can be reminded.
    if (!game.users.get(request.userId)?.active) {
      const recipient = requestRecipientForActor(await fromUuid(request.actorUuid));
      if (!recipient) throw new Error("No active user is available for this roll.");
      request.userId = recipient.user.id;
      await saveActiveJourney(journey);
    }
    await this.#send(request);
    this.dispatchEvent(new Event("updated"));
  }

  async #open(request) {
    await this.#dialogs.get(request.id)?.close();
    const dialog = new foundry.applications.api.DialogV2({
      classes: ["ml-window", "ml-journeys-dialog"],
      window: { title: "Morelord Journeys — Day Encounters", icon: "fa-solid fa-dice" },
      content: `<p>${actorIdentity(request)}: roll ${request.checks}d${request.dieFaces} for today's encounter checks. Only the GM sees the results.</p>`,
      buttons: [clientRollButton(async () => {
        const gm = activeGM();
        if (!gm) throw new Error("No active GM is available.");
        // The player triggers the roll; the GM evaluates it so the response never reveals dice.
        const acknowledgement = await this.#channel.executeAsUser("dayEncounter.roll", { requestId: request.id }, gm.id);
        if (!acknowledgement?.accepted) throw new Error(acknowledgement?.reason ?? "The roll was not accepted.");
        this.#dialogs.delete(request.id);
        return true;
      })]
    });
    this.#dialogs.set(request.id, dialog);
    await dialog.render({ force: true });
  }

  async #roll(requestId, execution) {
    if (!game.user.isGM) return { accepted: false, reason: "A GM must resolve this roll." };
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingDayEncounterRolls?.find(item => item.id === requestId);
    if (!request || journey.phase !== "encounters" || request.journeyId !== journey.id || request.dayNumber !== journey.dayNumber) return { accepted: false, reason: "This encounter request has expired." };
    if (execution.senderUserId !== request.userId) return { accepted: false, reason: "This roll belongs to another user." };
    const roll = await new Roll(`${request.checks}d${request.dieFaces}`).evaluate({ allowInteractive: false });
    const results = roll.dice.flatMap(die => die.results.filter(result => result.active !== false).map(result => result.result));
    const travelerRolls = [...(journey.currentDay.dayEncounterResults ?? []), { actorUuid: request.actorUuid, actorName: request.actorName, results }];
    const outcome = resolveDayEncounterChecks({ danger: request.checks, dieFaces: request.dieFaces, travelerRolls });
    journey.currentDay.dayEncounterResults = travelerRolls;
    journey.currentDay.pendingDayEncounterRolls = journey.currentDay.pendingDayEncounterRolls.filter(item => item.id !== requestId);
    if (!journey.currentDay.pendingDayEncounterRolls.length) {
      const actors = (await Promise.all(journey.travelers.map(traveler => fromUuid(traveler.actorUuid)))).filter(Boolean);
      const passives = actors.map(actor => Number(actor.system?.skills?.prc?.passive ?? 10 + Number(actor.system?.skills?.prc?.total ?? 0)));
      const pacePenalty = journey.currentDay.pace === "fast" ? -5 : 0;
      journey.currentDay.encounterCheck = { ...outcome, highestPassivePerception: (passives.length ? Math.max(...passives) : 0) + pacePenalty, pacePenalty, rolledAt: Date.now() };
    }
    await saveActiveJourney(journey);
    this.dispatchEvent(new Event("updated"));
    try {
      await displayJourneyRoll(roll, { flavor: `Morelord Journeys daytime checks — ${foundry.utils.escapeHTML(request.actorName)}` }, { messageMode: "blind" });
    } catch (error) { console.error("Morelord Journeys | Encounter recorded, but its private roll card could not be displayed.", error); }
    return { accepted: true };
  }
}

export const dayEncounterService = new DayEncounterService();
