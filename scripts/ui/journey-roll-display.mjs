import { skipDiceAnimation } from "../core/journey-settings.mjs";

export async function displayJourneyRoll(roll, messageData = {}) {
  if (skipDiceAnimation()) return null;
  return roll.toMessage(messageData);
}
