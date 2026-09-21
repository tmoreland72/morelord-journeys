import { updateJourneyDocument } from "./journey-undo-service.mjs";
export function exhaustionLevel(actor) {
  const exhaustion = actor?.system?.attributes?.exhaustion;
  const value = typeof exhaustion === "object" && exhaustion !== null ? exhaustion.value : exhaustion;
  const level = Number(value ?? 0);
  return Number.isFinite(level) ? level : 0;
}

export async function adjustActorExhaustion(actor, change) {
  if (!actor) throw new Error("The character could not be found.");
  const before = exhaustionLevel(actor);
  const after = Math.max(0, Math.min(6, before + Number(change ?? 0)));
  if (after === before) return { before, after, change: 0 };
  const exhaustion = actor.system?.attributes?.exhaustion;
  const path = typeof exhaustion === "object" && exhaustion !== null
    ? "system.attributes.exhaustion.value"
    : "system.attributes.exhaustion";
  await updateJourneyDocument(actor, { [path]: after });
  return { before, after, change: after - before };
}
