import { getActiveJourney } from "../foundry/settings-repository.mjs";
import { JOURNEY_STATE_SERIAL_KEY } from "../core/morelord-core-socket-service.mjs";

export function eligibleLongRests(journey) {
  const day = journey?.currentDay;
  if (!day || !journey.travelers?.length || day.pendingSleepRolls?.length
    || !journey.travelers.every(traveler => day.campSleepResults?.some(result => result.actorUuid === traveler.actorUuid))) return [];
  return day.campSleepResults.filter(result => result.longRestCompleted
    && journey.travelers.some(traveler => traveler.actorUuid === result.actorUuid));
}

export function startLongRestRequests() {
  MorelordCore.chatRequests.register("journeys.longRest", async (data, { actor }) => {
    const journey = await getActiveJourney();
    if (journey?.id !== data.journeyId || journey.dayNumber !== data.dayNumber
      || (journey.undoGeneration ?? 0) !== data.undoGeneration
      || !eligibleLongRests(journey).some(result => result.actorUuid === actor?.uuid && result.requestId === data.requestId)) {
      return { accepted: false, reason: "This Long Rest is no longer available." };
    }
    // Journeys already resolved Exhaustion; do not recover it or advance time again.
    const result = await actor.longRest({ dialog: false, exhaustionDelta: 0, advanceTime: false, advanceBastionTurn: false });
    return result ? { accepted: true } : { accepted: false, reason: "The Long Rest was cancelled." };
  }, { serialize: JOURNEY_STATE_SERIAL_KEY });
}

export async function sendLongRestRequests() {
  if (!game.user.isGM) throw new Error("Only the GM can send Long Rest buttons.");
  const journey = await getActiveJourney();
  const eligible = eligibleLongRests(journey);
  if (!eligible.length) throw new Error("Finish all Sleep & Shelter rolls first; at least one character must qualify for a Long Rest.");
  const undoGeneration = journey.undoGeneration ?? 0;
  const groupKey = `${journey.id}:${journey.dayNumber}:longRest:${undoGeneration}`;
  for (const result of eligible) {
    await MorelordCore.chatRequests.create({ type: "journeys.longRest", key: `${groupKey}:${result.requestId}:${result.actorUuid}`,
      groupKey, title: "Long Rest", actorUuid: result.actorUuid, modes: false, actionLabel: "Long Rest",
      data: { journeyId: journey.id, dayNumber: journey.dayNumber, undoGeneration, requestId: result.requestId } });
  }
}
