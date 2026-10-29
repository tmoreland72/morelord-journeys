import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { getMorelordSocketChannel, JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";
import { afterDiceAnimation } from "../../../morelord-core/scripts/services/dice-animation.js";
import { rollAuthority, completeChatRoll } from "../../../morelord-core/scripts/services/chat-roll-requests.js";
import { registerSystemCheckRoll, rollSystemCheck } from "./system-check-roll.mjs";

const requests = () => globalThis.MorelordCore.chatRequests;
export function createJourneyChatRequest(type, request, title, { modes = false } = {}) {
  if (!game.user.isGM) return; // Legacy socket delivery never creates player-authored cards.
  const groupKey = type === "role" ? null : `${request.journeyId}:${request.dayNumber}:${type}:${request.chatGroupId ?? "day"}`;
  return requests().create({ type: `journeys.${type}`, key: request.id, groupKey, groupTitle: type === "watch" ? "Watch Discovery Checks" : title, title, actorUuid: request.actorUuid,
    dc: request.dc ?? null, modes, data: { requestId: request.id, journeyId: request.journeyId, dayNumber: request.dayNumber } });
}

function waitForChatMessage(messageId, timeoutMs = 2000) {
  const existing = game.messages.get(messageId);
  if (existing || !globalThis.Hooks?.on) return Promise.resolve(existing ?? null);
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      Hooks.off("createChatMessage", onCreate);
      resolve(game.messages.get(messageId) ?? null);
    }, timeoutMs);
    const onCreate = message => {
      if (message.id !== messageId) return;
      clearTimeout(timeout);
      Hooks.off("createChatMessage", onCreate);
      resolve(message);
    };
    Hooks.on("createChatMessage", onCreate);
  });
}
export function registerJourneyChatRoll(type, { pendingKey, phase, options, apply }) {
  const findPending = (journey, data) => {
    const pending = journey?.currentDay?.[pendingKey];
    if (journey?.id !== data.journeyId || journey.dayNumber !== data.dayNumber || (phase && journey.phase !== phase)) return null;
    const request = Array.isArray(pending) ? pending.find(entry => entry.id === data.requestId) : pending?.id === data.requestId ? pending : null;
    return request && (!request.phase || journey.phase === request.phase) ? request : null;
  };
  const scheduleResult = (journey, request) => {
    void afterDiceAnimation(game.messages.get(request.chatRollResult.messageId), async () => {
      const current = await getActiveJourney();
      const pending = findPending(current, {journeyId:journey.id, dayNumber:journey.dayNumber, requestId:request.id});
      if (!pending?.chatRollResult || (current.undoGeneration ?? 0) !== (journey.undoGeneration ?? 0)) return;
      await apply(current, pending, pending.chatRollResult.result);
    }, JOURNEY_STATE_SERIAL_KEY).catch(error => ui.notifications.error(`Journey roll saved. Reload to retry its result: ${error.message}`));
  };
  registerSystemCheckRoll(getMorelordSocketChannel());
  requests().register(`journeys.${type}`, async (data, context) => {
    const journey = await getActiveJourney();
    const request = findPending(journey, data);
    if (!request || request.actorUuid !== context.actor?.uuid) return { accepted: false, reason: "This journey request is no longer pending." };
    if (request.chatRollResult) { scheduleResult(journey, request); return { accepted: true }; }
    const config = options(request);
    const { skipDiceAnimation } = await import("../core/journey-settings.mjs");
    const messageData = {
      flavor: config.title,
      speaker: ChatMessage.getSpeaker({ actor: context.actor }),
      flags: { "morelord-journeys": { journeyRequest: { journeyId: journey.id, requestId: request.id } } }
    };
    const messageConfig = { create: !skipDiceAnimation(), rollMode: "public", data: messageData };
    const rolled = await rollSystemCheck({
      actor: context.actor,
      senderUserId: context.senderUserId,
      skill: config.skill ?? null,
      ability: config.skill ? null : "con",
      dc: request.dc ?? null,
      advantage: Boolean(config.advantage),
      disadvantage: Boolean(config.disadvantage),
      message: messageConfig
    });
    if (rolled.cancelled) return { accepted: false, reason: rolled.reason ?? "The roll was cancelled." };
    const result = { total: rolled.total, natural: rolled.natural, succeeded: rolled.total >= request.dc, automatic: false, resolvedBy: context.senderUserId };
    let message = rolled.messageId ? game.messages.get(rolled.messageId) : null;
    if (!message && rolled.messageId) message = await waitForChatMessage(rolled.messageId);
    if (!message && !rolled.messageId && rolled.roll && messageConfig.create !== false) {
      try {
        const { displayJourneyRoll } = await import("../ui/journey-roll-display.mjs");
        message = await displayJourneyRoll(rolled.roll, messageData, { messageMode: "public" }, { waitForAnimation: false });
      } catch (error) { console.error("Journey chat display failed; recording the result.", error); }
    }
    request.chatRollResult = { result, messageId: message?.id ?? rolled.messageId ?? null };
    await saveActiveJourney(journey);
    scheduleResult(journey, request);
    return { accepted: true };
  }, { serialize: JOURNEY_STATE_SERIAL_KEY });
  // A reload during animation must apply the saved dice, never roll them again.
  if (game.user.isGM) void MorelordCore.socket.runSerialized(JOURNEY_STATE_SERIAL_KEY, async () => {
    const journey = await getActiveJourney(), pending = journey?.currentDay?.[pendingKey];
    for (const request of Array.isArray(pending) ? pending : pending ? [pending] : []) {
      if (!request.chatRollResult) continue;
      const card = game.messages.find(message => {
        const flag = message.getFlag("morelord-core", "rollRequest");
        return flag?.type === `journeys.${type}` && (flag.entries ? Object.values(flag.entries) : [flag]).some(entry => entry.data.requestId === request.id);
      });
      if (rollAuthority(card)?.id === game.user.id) {
        if (card) {
          const flag = card.getFlag("morelord-core", "rollRequest");
          const entry = flag.entries ? Object.entries(flag.entries).find(([, entry]) => entry.data.requestId === request.id) : ["", flag];
          if (!entry[1].completed) await completeChatRoll(card, entry[0]);
        }
        scheduleResult(journey, request);
      }
    }
  }).catch(error => ui.notifications.error(`Could not restore journey rolls: ${error.message}`));
}
