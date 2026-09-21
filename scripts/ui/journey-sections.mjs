import { activateCollapsibleSections, createCollapsibleSection } from "../../../morelord-core/scripts/ui/collapsible-section.js";

const PHASE_DESCRIPTIONS = {
  weather: "Check for extreme weather and generate the day's forecast before choosing a travel pace.",
  pace: "Choose how quickly the party travels today. Pace affects progress, perception, and other travel checks.",
  encounters: "Check for events along the route. Results are visible only to the GM.",
  discovery: "Resolve the Observer's check and decide whether the party investigates any discovered opportunity.",
  navigation: "Resolve the Navigator's check to determine whether the party stays on course, loses ground, or finds a shortcut.",
  foraging: "Resolve the party's foraging checks, then continue to apply food and water supplies.",
  pressOn: "Choose whether to extend today's travel and resolve the required Constitution saves.",
  camp: "Assign watches and camp activities, then check for nighttime encounters.",
  sleep: "Review each traveler's shelter and interruptions, resolve sleep checks, and record rest benefits.",
  dayComplete: "Review the day's results and record progress before preparing the next travel day."
};

export function prepareJourneySections(root, context) {
  const entries = [
    [root.querySelector(".journey-phase-card"), `phase-${context.journey.phase}`, context.phaseLabel, PHASE_DESCRIPTIONS[context.journey.phase]],
    [root.querySelector(".journey-roles-panel"), "active-roles", "Expedition Roles", "Review the characters responsible for the current phase and their assigned expedition duties."],
    [root.querySelector(".journey-supply-panel"), "active-supplies", "Supply Manifest", "Review travel supplies by character and shared inventory. Refresh to read current inventory quantities."],
    [root.querySelector(".journey-log"), "log", "Expedition Log", "Review the recorded phases and outcomes of this journey."],
    [root.querySelector(".ml-app-shell > .ml-empty-state"), context.isArrived ? "arrival" : "ready", context.isArrived ? "Destination Reached" : "Ready for the Road", context.isArrived ? "Finish the expedition when the party has arrived and its final outcomes are recorded." : "Review the daily route ratings and supplies, then begin the next travel day."]
  ];
  for (const [existing, key, title, description] of entries) {
    if (!existing || existing.tagName === "DETAILS") continue;
    const heading = existing.querySelector(":scope > .ml-section-heading");
    // Keep live controls (such as Refresh) outside the clickable summary.
    const helpButtons = heading ? [...heading.querySelectorAll(".journey-help-button")] : [];
    const actions = heading ? [...heading.querySelectorAll("button:not(.journey-help-button)")] : [];
    heading?.remove();
    if (existing.classList.contains("ml-empty-state")) {
      existing.querySelector(":scope > h2")?.remove();
      existing.querySelector(":scope > p")?.remove();
      existing.querySelector(":scope > i")?.remove();
    }
    const section = createCollapsibleSection({ key: `morelord-journeys.${key}`, title, description, content: [...actions, ...existing.childNodes] });
    for (const name of existing.classList) if (!["ml-surface", "ml-stack", "ml-empty-state"].includes(name)) section.classList.add(name);
    const titleElement = section.querySelector("summary h2");
    for (const button of helpButtons) {
      button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); });
      titleElement?.append(" ", button);
    }
    existing.replaceWith(section);
  }
  activateCollapsibleSections({ element: root });
}
