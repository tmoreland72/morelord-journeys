import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";
import { naturalD20 } from "../domain/d20-roll.mjs";
import { afterDiceAnimation } from "../../../morelord-core/scripts/services/dice-animation.js";
import { rollAuthority, completeChatRoll } from "../../../morelord-core/scripts/services/chat-roll-requests.js";

const requests = () => globalThis.MorelordCore.chatRequests;
export function createJourneyChatRequest(type, request, title, { modes = true } = {}) {
  if (!game.user.isGM) return; // Legacy socket delivery never creates player-authored cards.
  const groupKey = type === "role" ? null : `${request.journeyId}:${request.dayNumber}:${type}:${request.chatGroupId ?? "day"}`;
  return requests().create({ type: `journeys.${type}`, key: request.id, groupKey, groupTitle: type === "watch" ? "Watch Discovery Checks" : title, title, actorUuid: request.actorUuid,
    dc: request.dc ?? null, modes, data: { requestId: request.id, journeyId: request.journeyId, dayNumber: request.dayNumber } });
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
  requests().register(`journeys.${type}`, async (data, context) => {
    const journey = await getActiveJourney();
    const request = findPending(journey, data);
    if (!request || request.actorUuid !== context.actor?.uuid) return { accepted: false, reason: "This journey request is no longer pending." };
    if (request.chatRollResult) { scheduleResult(journey, request); return { accepted: true }; }
    const config = options(request);
    const advantage = Boolean(config.advantage || context.mode === "adv");
    const disadvantage = Boolean(config.disadvantage || context.mode === "dis");
    let roll;
    if (config.skill) roll = (await MorelordCore.rolls.skill(context.actor, config.skill, { dc: request.dc ?? null, configure: false, create: false, advantage, disadvantage })).roll;
    else {
      const native = await context.actor.rollSavingThrow({ ability: "con", target: request.dc, advantage, disadvantage }, { configure: false }, { create: false });
      roll = Array.isArray(native) ? native[0] : native?.rolls?.[0] ?? native?.roll ?? native;
    }
    if (!Number.isFinite(roll?.total)) throw new Error("The requested roll did not return a total.");
    const result = { total: roll.total, natural: naturalD20(roll), succeeded: roll.total >= request.dc, automatic: false, resolvedBy: context.senderUserId };
    const { displayJourneyRoll } = await import("../ui/journey-roll-display.mjs");
    let message;
    try { message = await displayJourneyRoll(roll, { flavor: config.title, speaker: ChatMessage.getSpeaker({actor:context.actor}),
      flags: {"morelord-journeys": {journeyRequest: {journeyId:journey.id, requestId:request.id}}}
    }, { messageMode: "public" }, { waitForAnimation: false }); }
    catch (error) { console.error("Journey chat display failed; recording the result.", error); }
    request.chatRollResult = { result, messageId: message?.id ?? null };
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
