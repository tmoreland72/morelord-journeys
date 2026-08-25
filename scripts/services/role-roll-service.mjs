import { MODULE_ID } from "../domain/constants.mjs";
import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";

const SOCKET = `module.${MODULE_ID}`;

export function roleRollOutcome({ phase, total, dc, automatic = null }) {
  if (phase === "navigation") {
    if (automatic === true) return "success";
    if (automatic === false) return "lost";
    return total >= dc ? "success" : total <= dc - 5 ? "reversed" : "lost";
  }
  if (automatic !== null) return automatic ? "success" : "failure";
  return total >= dc ? "success" : "failure";
}

class RoleRollService extends EventTarget {
  #started = false;
  #dialogs = new Map();

  start() {
    if (this.#started) return;
    this.#started = true;
    game.socket.on(SOCKET, message => void this.#receive(message));
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
    const targetUserIds = this.#roleUsers(actor);
    if (!targetUserIds.length) throw new Error(`${actor.name} has no active owner available to make the roll.`);
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
      requestedAt: Date.now()
    };
    journey.currentDay.pendingRoleRoll = request;
    await saveActiveJourney(journey);
    if (request.targetUserIds.includes(game.user.id)) await this.#openClientRoll(request);
    else game.socket.emit(SOCKET, { type: "roleRoll.request", request });
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
    request.resentAt = Date.now();
    request.resendCount = Number(request.resendCount ?? 0) + 1;
    await saveActiveJourney(journey);
    if (request.targetUserIds.includes(game.user.id)) await this.#openClientRoll(request, { replace: true });
    else game.socket.emit(SOCKET, { type: "roleRoll.request", request });
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
      if (!pending || pending.id !== message.requestId) return;
      await this.#saveResult(journey, pending, message.result);
      return;
    }
    if (message?.type === "roleRoll.resolved") {
      const dialog = this.#dialogs.get(message.requestId);
      if (dialog) await dialog.close();
      this.#dialogs.delete(message.requestId);
    }
  }

  async #openClientRoll(request, { replace = false } = {}) {
    if (this.#dialogs.has(request.id) && !replace) return;
    if (replace) await this.#dialogs.get(request.id)?.close();
    const actor = await fromUuid(request.actorUuid);
    if (!actor) return;
    ui.notifications.info(`${request.actorName} has a pending ${request.role} check.`);
    const content = document.createElement("div");
    const text = document.createElement("p");
    text.textContent = `${request.actorName} must make a ${request.skillId === "sur" ? "Survival" : "Perception"} check against DC ${request.dc}.${request.disadvantage ? " Extreme weather imposes disadvantage." : ""}`;
    content.append(text);
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `Morelord Journeys — ${request.role === "navigator" ? "Navigator" : "Observer"}` },
      content,
      modal: false,
      buttons: [{
        action: "roll",
        label: "Roll Check",
        icon: "fa-solid fa-dice-d20",
        default: true,
        callback: async () => {
          const native = await actor.rollSkill(
            { skill: request.skillId, target: request.dc, disadvantage: request.disadvantage },
            { configure: true, title: `${request.actorName} — DC ${request.dc}` },
            { create: true, data: { flavor: `Morelord Journeys ${request.role} check — DC ${request.dc}` } }
          );
          if (!native) return null;
          const roll = Array.isArray(native) ? native[0] : native?.rolls?.[0] ?? native?.roll ?? native;
          const total = Number(roll?.total ?? native?.total ?? Number.NaN);
          if (!Number.isFinite(total)) throw new Error("The role check did not return a numeric total.");
          const result = {
              automatic: false,
              total,
              outcome: roleRollOutcome({ phase: request.phase, total, dc: request.dc }),
              resolvedBy: game.user.id
          };
          if (game.user.isGM) {
            const current = await getActiveJourney();
            const pending = current?.currentDay?.pendingRoleRoll;
            if (pending?.id === request.id) await this.#saveResult(current, pending, result);
          } else game.socket.emit(SOCKET, { type: "roleRoll.result", requestId: request.id, result });
          return total;
        }
      }]
    });
    this.#dialogs.set(request.id, dialog);
    await dialog.render({ force: true });
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
    game.socket.emit(SOCKET, { type: "roleRoll.resolved", requestId: request.id, targetUserIds: request.targetUserIds });
    this.#updated();
  }

  #roleUsers(actor) {
    const active = game.users.filter(user => user.active);
    const characterOwner = active.find(user => user.character?.uuid === actor.uuid);
    if (characterOwner) return [characterOwner.id];
    const owner = active.find(user => actor.testUserPermission?.(user, "OWNER"));
    if (owner) return [owner.id];
    return game.user.isGM ? [game.user.id] : [];
  }

  #updated() {
    this.dispatchEvent(new Event("updated"));
  }
}

export const roleRollService = new RoleRollService();
