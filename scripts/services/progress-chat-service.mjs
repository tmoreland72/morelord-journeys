import { TRAVEL_PHASES } from "../domain/constants.mjs";

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
    const index = TRAVEL_PHASES.indexOf(phase);
    const label = game.i18n.localize(`MORELORD_JOURNEYS.Phases.${phase}`);
    return { icon: "fa-person-hiking", title: `${label} Complete`, body: `Day ${entry.dayNumber}, step ${index + 1} of ${TRAVEL_PHASES.length - 1} is complete.` };
  }
  return null;
}

export async function publishJourneyProgress(prior, journey) {
  if (!game.user?.isGM) return;
  const known = new Set(prior?.log?.map(entry => entry.id) ?? []);
  for (const entry of journey.log.filter(item => !known.has(item.id))) {
    const message = describe(entry, journey);
    if (!message) continue;
    const content = `<article class="ml-chat-card ml-journeys-chat-card"><header><i class="fa-solid ${message.icon}"></i><strong>${escape(message.title)}</strong></header><p>${escape(message.body)}</p></article>`;
    await ChatMessage.create({ content, speaker: { alias: "Morelord Journeys" } });
  }
}
