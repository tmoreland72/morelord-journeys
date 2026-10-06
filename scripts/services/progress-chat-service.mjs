import { MODULE_ID } from "../domain/constants.mjs";
import { includedJourneyPhases } from "../core/journey-step-policy.mjs";

const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const formatSteps = steps => {
  const value = Number(steps ?? 0);
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const days = Math.floor(absolute / 3);
  const remainder = absolute % 3;
  return `${sign}${days || !remainder ? days : ""}${remainder === 1 ? "⅓" : remainder === 2 ? "⅔" : ""}`;
};

function describe(entry, journey) {
  if (entry.type === "journeyReady") return { icon: "fa-route", title: "Journey Planned", body: `${journey.name} is ready to depart.` };
  if (entry.type === "dayStarted") return { icon: "fa-sun", title: `Day ${entry.dayNumber} Begins`, body: `The party sets out toward ${journey.routeSnapshot.destination.name}.` };
  if (entry.type === "dayCompleted") {
    const applied = entry.data?.applied ?? 0;
    return { icon: "fa-flag-checkered", title: `Day ${entry.dayNumber} Complete`, body: `The route changed by ${formatSteps(applied)} travel day${Math.abs(applied) === 3 ? "" : "s"}.` };
  }
  if (entry.type === "journeyArrived") return { icon: "fa-location-dot", title: "Destination Reached", body: `The party has arrived at ${journey.routeSnapshot.destination.name}.` };
  if (entry.type === "phaseRecorded") {
    const phase = entry.data?.phase ?? entry.phase;
    const phases = includedJourneyPhases(journey, entry.dayNumber);
    const index = phases.indexOf(phase);
    if (entry.data?.result?.skipped || index < 0) return null;
    const label = game.i18n.localize(`MORELORD_JOURNEYS.Phases.${phase}`);
    return { icon: "fa-person-hiking", title: `${label} Complete`, body: `Day ${entry.dayNumber}, step ${index + 1} of ${phases.length} is complete.` };
  }
  return null;
}

export async function publishJourneyProgress(prior, journey) {
  if (!game.user?.isGM) return;
  await reconcileJourneyProgress(journey);
  const known = new Set(prior?.log?.map(entry => entry.id) ?? []);
  for (const entry of journey.log.filter(item => !known.has(item.id))) {
    const message = describe(entry, journey);
    if (!message) continue;
    const content = `<article class="ml-chat-card ml-journeys-chat-card"><header><i class="fa-solid ${message.icon}"></i><strong>${escape(message.title)}</strong></header><p>${escape(message.body)}</p></article>`;
    await ChatMessage.create({ content, speaker: { alias: "Morelord Journeys" }, flags: { [MODULE_ID]: { journeyProgress: { journeyId: journey.id, entryId: entry.id, dayNumber: entry.dayNumber, phase: entry.type === "phaseRecorded" ? entry.data?.phase ?? entry.phase : null } } } });
  }
}

async function reconcileJourneyProgress(journey) {
  // Unmarked historical cards cannot safely be attributed to a journey.
  for (const message of [...(game.messages?.contents ?? [])]) {
    const marker = message.flags?.[MODULE_ID]?.journeyProgress;
    if (marker?.journeyId !== journey.id || !marker.phase) continue;
    const entry = journey.log.find(item => item.id === marker.entryId);
    if (!entry || !describe(entry, journey)) await message.delete();
    else if (marker) {
      const description = describe(entry, journey);
      const body = `<p>${escape(description.body)}</p>`;
      const content = message.content.replace(/<p>.*?<\/p>/s, body);
      if (content !== message.content) await message.update({ content });
    }
  }
}
