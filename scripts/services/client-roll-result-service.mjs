import { activeGM } from "./client-request-routing-service.mjs";

export async function sendClientRollResult(channel, event, request, result) {
  const gm = activeGM();
  if (!gm) throw new Error("No active GM is available to receive the roll result.");
  const acknowledgement = await channel.executeAsUser(event, { requestId: request.id, result }, gm.id, {
    context: { journeyId: request.journeyId, requestId: request.id }
  });
  if (acknowledgement?.accepted === false) throw new Error(acknowledgement.reason || "The GM did not accept the roll result.");
  return acknowledgement;
}
