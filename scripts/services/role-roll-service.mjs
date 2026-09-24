import { createJourneyChatRequest, registerJourneyChatRoll } from "./chat-roll-service.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { actorIdentity } from "../../../morelord-core/scripts/ui/actor-identity.js";
import { requestRecipientForActor } from "./client-request-routing-service.mjs";
import { getMorelordSocketChannel, JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";
import { naturalD20 } from "../domain/d20-roll.mjs";
import { navigationOutcome } from "../domain/navigation-rules.mjs";
import { activeGM } from "./client-request-routing-service.mjs";
import { clientRollButton } from "../ui/client-roll-dialog.mjs";

export function roleRollOutcome({ phase, total, dc, natural = null, automatic = null }) {
  if (phase === "navigation") {
    return navigationOutcome({ total, dc, natural, automatic });
  }
  if (automatic !== null) return automatic ? "success" : "failure";
  return total >= dc ? "success" : "failure";
}

class RoleRollService extends EventTarget {
  #started = false;
  #dialogs = new Map();
  #channel = null;

  start() {
    if (this.#started) return;
    this.#started = true;
    this.#channel = getMorelordSocketChannel();
    registerJourneyChatRoll("role", {pendingKey:"pendingRoleRoll", phase:null, options:request => ({skill:request.skillId,disadvantage:request.disadvantage,title:request.phase === "navigation" ? "Navigation Check" : "Discovery Check"}), apply:async (journey,request,result) => { await this.#saveResult(journey,request,{...result,outcome:roleRollOutcome({phase:request.phase,total:result.total,dc:request.dc,natural:result.natural})}); } });
    this.#channel.on("roleRoll.request", data => this.#receive({ type: "roleRoll.request", ...data }));
    this.#channel.on("roleRoll.result", data => this.#receive({ type: "roleRoll.result", ...data }), { serialize: JOURNEY_STATE_SERIAL_KEY });
    this.#channel.on("roleRoll.resolved", data => this.#receive({ type: "roleRoll.resolved", ...data }));
  }

  async request({ phase }) {
    if (!game.user.isGM) throw new Error("Only a GM can request a journey role check.");
    const journey = await getActiveJourney();
    if (!journey?.currentDay || journey.phase !== phase) throw new Error(`The journey is not in the ${phase} phase.`);
    const role = phase === "navigation" ? "navigator" : "observer";
    const actorUuid = journey.roles?.[`${role}Uuid`];
    const actor = actorUuid ? await fromUuid(actorUuid) : null;
    if (!actor) throw new Error(`The assigned ${role} could not be found.`);
    const dc = phase === "navigation" ? journey.routeSnapshot.navigationDC : journey.routeSnapshot.discoveryDC;
    const skillId = phase === "navigation" ? "sur" : "prc";
    const recipient = requestRecipientForActor(actor);
    const targetUserIds = recipient ? [recipient.user.id] : [];
    if (dc !== 0 && !targetUserIds.length) throw new Error(`${actor.name} has no active owner available to make the roll.`);
    const request = {
      id: crypto.randomUUID(),
      journeyId: journey.id,
      dayNumber: journey.dayNumber,
      phase,
      role,
      actorUuid,
      actorName: actor.name,
      skillId,
      dc,
      disadvantage: phase === "navigation" && Boolean(journey.currentDay?.phases?.weather?.extreme),
      targetUserIds,
      fallbackToGM: recipient?.fallbackToGM ?? false,
      requestedAt: Date.now()
    };
    if (dc === 0) {
      await this.#saveResult(journey, request, { total: null, outcome: "success", automatic: true, automaticReason: "zeroDC", resolvedBy: game.user.id });
      return request;
    }
    journey.currentDay.pendingRoleRoll = request;
    await saveActiveJourney(journey);
    await this.#openClientRoll(request);
    this.#updated();
    return request;
  }

  async autoResolve(succeeded) {
    if (!game.user.isGM) throw new Error("Only a GM can resolve a pending role check.");
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingRoleRoll;
    if (!request) throw new Error("There is no pending role check.");
    await this.#saveResult(journey, request, {
      automatic: true,
      total: null,
      outcome: roleRollOutcome({ phase: request.phase, dc: request.dc, automatic: succeeded }),
      resolvedBy: game.user.id
    });
  }

  async autoResolveOutcome(outcome) {
    if (!game.user.isGM) throw new Error("Only a GM can resolve a pending role check.");
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingRoleRoll;
    if (!request || request.phase !== "navigation") throw new Error("There is no pending Navigation check.");
    if (!["success", "lost", "reversed"].includes(outcome)) throw new Error("Unknown Navigation outcome.");
    await this.#saveResult(journey, request, { automatic: true, total: null, outcome, resolvedBy: game.user.id });
  }

  async resend() {
    if (!game.user.isGM) throw new Error("Only a GM can resend a journey role check.");
    const journey = await getActiveJourney();
    const request = journey?.currentDay?.pendingRoleRoll;
    if (!request) throw new Error("There is no pending role check.");
    const actor = await fromUuid(request.actorUuid);
    const recipient = requestRecipientForActor(actor);
    if (!recipient) throw new Error(`${request.actorName} has no active user available to make the roll.`);
    request.targetUserIds = [recipient.user.id];
    request.fallbackToGM = recipient.fallbackToGM;
    request.resentAt = Date.now();
    request.resendCount = Number(request.resendCount ?? 0) + 1;
    await saveActiveJourney(journey);
    await this.#openClientRoll(request);
    this.#updated();
  }

  getPending(journey) {
    return journey?.currentDay?.pendingRoleRoll ?? null;
  }

  getResult(journey, phase) {
    return journey?.currentDay?.roleRollResults?.[phase] ?? null;
  }

  async #receive(message) {
    if (message?.type === "roleRoll.request" && message.request?.targetUserIds?.includes(game.user.id)) {
      return this.#openClientRoll(message.request);
    }
    if (message?.type === "roleRoll.result" && game.user.isGM) {
      const journey = await getActiveJourney();
      const pending = journey?.currentDay?.pendingRoleRoll;
      if (!pending || pending.id !== message.requestId) return { accepted: false, reason: "The Navigation request is no longer pending." };
      await this.#saveResult(journey, pending, message.result);
      return { accepted: true };
    }
    if (message?.type === "roleRoll.resolved") {
      const dialog = this.#dialogs.get(message.requestId);
      if (dialog) await dialog.close();
      this.#dialogs.delete(message.requestId);
    }
  }

  async #openClientRoll(request) {
    return createJourneyChatRequest("role",request,request.phase === "navigation" ? "Navigation Check" : "Discovery Check");
  }

  async #saveResult(journey, request, result) {
    journey.currentDay.roleRollResults ??= {};
    journey.currentDay.roleRollResults[request.phase] = {
      requestId: request.id,
      actorUuid: request.actorUuid,
      actorName: request.actorName,
      dc: request.dc,
      ...result,
      resolvedAt: Date.now()
    };
    journey.currentDay.pendingRoleRoll = null;
    await saveActiveJourney(journey);
    const targetUserId = request.targetUserIds?.[0];
    if (targetUserId === game.user.id) { await this.#dialogs.get(request.id)?.close(); this.#dialogs.delete(request.id); }
    this.#updated();
  }

  #updated() {
    this.dispatchEvent(new Event("updated"));
  }
}

export const roleRollService = new RoleRollService();
