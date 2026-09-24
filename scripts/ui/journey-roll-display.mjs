import { skipDiceAnimation } from "../core/journey-settings.mjs";
import { waitForDiceAnimation } from "../../../morelord-core/scripts/services/dice-animation.js";

export async function displayJourneyRoll(roll, messageData = {}, options = {}, { waitForAnimation = true } = {}) {
  if (skipDiceAnimation()) return null;
  const message = await roll.toMessage(messageData, options);
  if (waitForAnimation) await waitForDiceAnimation(message);
  return message;
}
