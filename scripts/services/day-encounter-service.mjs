import { createJourneyChatRequest } from "./chat-roll-service.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";

import { resolveDayEncounterChecks, dangerDie, resolveDangerDice } from "../domain/encounter-rules.mjs";
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
    MorelordCore.chatRequests.register("journeys.dayEncounter",async (data,context) => {
      const journey=await getActiveJourney();
      const request=journey?.currentDay?.pendingDayEncounterRolls?.find(r=>r.id===data.requestId);
      if (!request || request.actorUuid!==context.actor?.uuid) return {accepted:false,reason:"This encounter request is no longer pending."};
      return this.#roll(request.id,{senderUserId:request.userId});
    },{serialize:JOURNEY_STATE_SERIAL_KEY});
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
    const danger = Number(journey.routeSnapshot.danger);
    const checks = 1;
    const dieFaces = dangerDie(danger);
    const requests = [];
    for (const traveler of journey.travelers) {
      const actor = await fromUuid(traveler.actorUuid);
      if (!actor) throw new Error(`${traveler.name}'s actor is unavailable.`);
      const recipient = requestRecipientForActor(actor);
      if (!recipient) throw new Error(`No active user can roll for ${traveler.name}.`);
      requests.push({ id: crypto.randomUUID(), journeyId: journey.id, dayNumber: journey.dayNumber,
        actorUuid: traveler.actorUuid, actorName: traveler.name, userId: recipient.user.id, checks, dieFaces, danger, rulesVersion: 2 });
    }
    for (const request of requests) request.chatGroupId = requests[0].id;
    journey.currentDay.pendingDayEncounterRolls = requests;
    journey.currentDay.dayEncounterResults = [];
    await saveActiveJourney(journey);
    this.dispatchEvent(new Event("updated"));
    for (const request of requests) await this.#send(request);
    return { accepted: true };
  }

  async #send(request) {
    return createJourneyChatRequest("dayEncounter",request,`Day Encounters · ${request.checks}d${request.dieFaces}`,{modes:false});
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
    const outcome = request.rulesVersion === 2
      ? { ...resolveDangerDice({ danger: request.danger, results: travelerRolls.flatMap(entry => entry.results) }), method: "partyDice", checksPerTraveler: 1, travelerRolls }
      : resolveDayEncounterChecks({ danger: request.checks, dieFaces: request.dieFaces, travelerRolls });
    journey.currentDay.dayEncounterResults = travelerRolls;
    journey.currentDay.pendingDayEncounterRolls = journey.currentDay.pendingDayEncounterRolls.filter(item => item.id !== requestId);
    if (!journey.currentDay.pendingDayEncounterRolls.length) {
      const actors = (await Promise.all(journey.travelers.map(traveler => fromUuid(traveler.actorUuid)))).filter(Boolean);
      const passives = actors.map(actor => Number(actor.system?.skills?.prc?.passive ?? 10 + Number(actor.system?.skills?.prc?.total ?? 0)));
      const pacePenalty = journey.currentDay.pace === "fast" ? -5 : 0;
      journey.currentDay.encounterCheck = { ...outcome, highestPassivePerception: (passives.length ? Math.max(...passives) : 0) + pacePenalty, pacePenalty, rolledAt: Date.now() };
    }
    try {
      await displayJourneyRoll(roll, { flavor: `Morelord Journeys daytime checks — ${foundry.utils.escapeHTML(request.actorName)}` }, { messageMode: "blind" });
    } catch (error) { console.error("Morelord Journeys | Encounter chat display failed; recording the result.", error); }
    await saveActiveJourney(journey);
    this.dispatchEvent(new Event("updated"));
    return { accepted: true };
  }
}

export const dayEncounterService = new DayEncounterService();
