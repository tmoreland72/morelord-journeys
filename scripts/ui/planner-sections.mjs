import { activateCollapsibleSections, createCollapsibleSection } from "../../../morelord-core/scripts/ui/collapsible-section.js";

export function preparePlannerSections(root) {
  const party = root.querySelector(".journey-party-planner");
  const roles = root.querySelector(".journey-expedition-roles");
  const supplies = root.querySelector(".journey-planner-supply-panel");
  if (party?.contains(roles)) party.after(roles);
  if (roles && supplies) roles.after(supplies);
  for (const [name, title, description] of [
    ["route-planner", "Journey Distance", "Choose the origin and destination, then set the expected travel time in days and thirds of a day."],
    ["route-ratings", "Route Ratings", "Set the danger and difficulty of discovering opportunities, finding supplies, and navigating the route."],
    ["party-planner", "Expedition Party", "Select the characters traveling together and review each character’s required Long Rest hours."],
    ["expedition-roles", "Expedition Roles", "Assign different characters as Navigator and Observer. Their skill bonuses appear beside their names."],
    ["planner-supply-panel", "Supply Manifest", "Review travel supplies by character and shared party inventory. Quantities come from their current inventories."]
  ]) {
    const existing = root.querySelector(`section.journey-${name}`);
    if (!existing) continue;
    existing.querySelector(":scope > .ml-section-heading")?.remove();
    const section = createCollapsibleSection({ key: `morelord-journeys.${name}`, title, description, content: [...existing.childNodes] });
    section.classList.add(`journey-${name}`);
    if (name === "planner-supply-panel") section.dataset.plannerSupplyManifest = "";
    existing.replaceWith(section);
  }
  activateCollapsibleSections({ element: root });
}
