import { assert } from "../../../morelord-core/scripts/testing/in-game.js";
import { createJourneyChatRequest } from "../services/chat-roll-service.mjs";

export const groupedRollsCheck = { id: "journeys.grouped-roll-cards", async run() {
  const actors = [], messages = new Set(), journeyId = foundry.utils.randomID();
  try {
    for (const name of ["Grouped travel fixture A", "Grouped travel fixture B"]) actors.push(await Actor.create({ name, type: "character" }));
    for (const type of ["dayEncounter", "foraging", "pressOn", "sleep", "watch"]) {
      const requests = actors.map((actor, index) => ({ id: foundry.utils.randomID(), journeyId, dayNumber: 1, actorUuid: actor.uuid, dc: 12 + index, chatGroupId: "batch" }));
      const first = await createJourneyChatRequest(type, requests[0], `${type} group check`, { modes: type !== "dayEncounter" });
      messages.add(first.id);
      const second = await createJourneyChatRequest(type, requests[1], `${type} group check`, { modes: type !== "dayEncounter" });
      messages.add(second.id);
      assert(first.id === second.id, `${type} groups both characters into one message.`);
      const entries = Object.values(first.getFlag("morelord-core", "rollRequest").entries);
      assert(entries.length === 2 && entries[0].dc === 12 && entries[1].dc === 13, "Individual DCs are preserved.");
      const resent = await createJourneyChatRequest(type, requests[0], `${type} group check`);
      assert(resent.id === first.id && Object.keys(resent.getFlag("morelord-core", "rollRequest").entries).length === 2, "Resend reuses the grouped card without duplicate characters.");
      assert(!first.whisper.length && !first.blind, "Request cards remain public without exposing private roll results.");
    }
  } finally {
    if (messages.size) await ChatMessage.deleteDocuments([...messages]);
    for (const actor of actors) await actor.delete();
  }
} };
