import { actorIdentity } from "../../../morelord-core/scripts/ui/actor-identity.js";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { requestRecipientForActor } from "./client-request-routing-service.mjs";
import { getMorelordSocketChannel, JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";
import { getDCConfiguration } from "../core/journey-settings.mjs";
import { adjustActorExhaustion } from "./actor-exhaustion-service.mjs";
import { clientRollButton } from "../ui/client-roll-dialog.mjs";
import { sendClientRollResult } from "./client-roll-result-service.mjs";

class ForcedMarchRollService extends EventTarget {
  #started = false;
  #dialogs = new Map();
  #channel = null;

  start() {
    if (this.#started) return;
    this.#started = true;
    this.#channel = getMorelordSocketChannel();
    this.#channel.on("forcedMarch.request", data => this.#receive({ type: "forcedMarch.request", ...data }));
    this.#channel.on("forcedMarch.result", data => this.#receive({ type: "forcedMarch.result", ...data }), { serialize: JOURNEY_STATE_SERIAL_KEY });
    this.#channel.on("forcedMarch.resolved", data => this.#receive({ type: "forcedMarch.resolved", ...data }));
  }

  async requestParty() {
    if (!game.user.isGM) throw new Error("Only the GM can request forced-march saves.");
    const journey = await getActiveJourney();
    if (journey?.phase !== "pressOn") throw new Error("The journey is not in the Press On phase.");
    if (journey.currentDay?.pace === "stopped") throw new Error("A stopped party cannot press on.");
    const requests = [];
    for (const traveler of journey.travelers) {
      const actor = await fromUuid(traveler.actorUuid);
      if (!actor) continue;
      const recipient = getDCConfiguration().pressOn === 0 ? { user: game.user, fallbackToGM: false } : requestRecipientForActor(actor);
      if (!recipient) continue;
      requests.push({ id: crypto.randomUUID(), journeyId: journey.id, dayNumber: journey.dayNumber, actorUuid: actor.uuid, actorName: actor.name, userId: recipient.user.id, fallbackToGM: recipient.fallbackToGM, dc: getDCConfiguration().pressOn });
    }
    journey.currentDay.pendingForcedMarchRolls = requests;
    journey.currentDay.forcedMarchResults = [];
    await saveActiveJourney(journey);
    for (const request of requests) {
      if (request.dc === 0) await this.#record(journey, request, { total: null, succeeded: true, automatic: true, automaticReason: "zeroDC", resolvedBy: game.user.id });
      else if (request.userId === game.user.id) await this.#open(request);
      else await this.#channel.executeAsUser("forcedMarch.request", { request }, request.userId, { context: { journeyId: request.journeyId, requestId: request.id } });
    }
    this.#updated();
  }

  async autoResolve(requestId, succeeded) {
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingForcedMarchRolls?.find(candidate => candidate.id === requestId);
    if (!request) throw new Error("That forced-march save is no longer pending.");
    const actor = await fromUuid(request.actorUuid);
    const recipient = requestRecipientForActor(actor);
    if (!recipient) throw new Error(`${request.actorName} has no active user available to make the roll.`);
    request.userId = recipient.user.id;
    request.fallbackToGM = recipient.fallbackToGM;
    await this.#record(journey, request, { total: null, succeeded, automatic: true });
  }

  async resend(requestId) {
    if (!game.user.isGM) throw new Error("Only the GM can resend forced-march saves.");
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingForcedMarchRolls?.find(candidate => candidate.id === requestId);
    if (!request) throw new Error("That forced-march save is no longer pending.");
    request.resentAt = Date.now();
    request.resendCount = Number(request.resendCount ?? 0) + 1;
    await saveActiveJourney(journey);
    if (request.userId === game.user.id) await this.#open(request, { replace: true });
    else await this.#channel.executeAsUser("forcedMarch.request", { request }, request.userId, { context: { journeyId: request.journeyId, requestId: request.id } });
    this.#updated();
  }

  async #receive(message) {
    if (message?.type === "forcedMarch.request" && message.request?.userId === game.user.id) return this.#open(message.request);
    if (message?.type === "forcedMarch.result" && game.user.isGM) {
      const journey = await getActiveJourney();
      const request = journey?.currentDay?.pendingForcedMarchRolls?.find(candidate => candidate.id === message.requestId);
      if (!request) return { accepted: false, reason: "That forced-march save is no longer pending." };
      await this.#record(journey, request, message.result);
      return { accepted: true };
    }
    if (message?.type === "forcedMarch.resolved") {
      await this.#dialogs.get(message.requestId)?.close();
      this.#dialogs.delete(message.requestId);
    }
  }

  async #open(request, { replace = false } = {}) {
    if (this.#dialogs.has(request.id) && !replace) return;
    if (replace) await this.#dialogs.get(request.id)?.close();
    const actor = await fromUuid(request.actorUuid);
    if (!actor) return;
    const dialog = new foundry.applications.api.DialogV2({
      classes: ["ml-window", "ml-journeys-dialog"],
      window: { title: "Morelord Journeys — Forced March", icon: "fa-solid fa-person-running" },
      content: `<p>${actorIdentity(actor)} presses on for two more hours and must make a DC ${request.dc} Constitution saving throw.</p>`,
      modal: false,
      buttons: [clientRollButton(async () => {
        if (typeof actor.rollSavingThrow !== "function") throw new Error(`${actor.name} cannot make a D&D 5e Constitution saving throw.`);
        const native = await actor.rollSavingThrow(
          { ability: "con", target: request.dc },
          { configure: true, title: `${actor.name} — Forced march save DC ${request.dc}` },
          { create: true, data: { flavor: `${actor.name} — Forced march save DC ${request.dc}` } }
        );
        if (!native) return null;
        const roll = Array.isArray(native) ? native[0] : native?.rolls?.[0] ?? native?.roll ?? native;
        const total = Number(roll?.total ?? native?.total ?? Number.NaN);
        if (!Number.isFinite(total)) throw new Error("The Constitution saving throw did not return a numeric total.");
        const result = { total, succeeded: total >= request.dc, automatic: false, resolvedBy: game.user.id };
        if (game.user.isGM) {
          const current = await getActiveJourney();
          const pending = current?.currentDay?.pendingForcedMarchRolls?.find(candidate => candidate.id === request.id);
          if (pending) await this.#record(current, pending, result);
        } else {
          await sendClientRollResult(this.#channel, "forcedMarch.result", request, result);
          this.#dialogs.delete(request.id);
        }
        return total;
      })]
    });
    this.#dialogs.set(request.id, dialog);
    await dialog.render({ force: true });
  }

  async #record(journey, request, result) {
    if (!result.succeeded) {
      const actor = await fromUuid(request.actorUuid);
      if (actor) {
        await adjustActorExhaustion(actor, 1);
      }
    }
    journey.currentDay.forcedMarchResults ??= [];
    journey.currentDay.forcedMarchResults.push({ actorUuid: request.actorUuid, actorName: request.actorName, dc: request.dc, ...result, exhaustionChange: result.succeeded ? 0 : 1, resolvedAt: Date.now() });
    journey.currentDay.pendingForcedMarchRolls = journey.currentDay.pendingForcedMarchRolls.filter(candidate => candidate.id !== request.id);
    await saveActiveJourney(journey);
    if (request.userId === game.user.id) { await this.#dialogs.get(request.id)?.close(); this.#dialogs.delete(request.id); }
    this.#updated();
  }

  #updated() { this.dispatchEvent(new Event("updated")); }
}

export const forcedMarchRollService = new ForcedMarchRollService();
