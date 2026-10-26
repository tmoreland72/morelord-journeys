import { MODULE_ID } from "../domain/constants.mjs";
import { addMorelordTool } from "./add-morelord-tool.mjs";

export function openJourneysTool() {
  const api = globalThis.MorelordJourneys ?? game.modules.get(MODULE_ID)?.api;
  if (!api?.open) return ui.notifications.warn("Morelord Journeys is still initializing.");
  return api.open();
}

export function journeysToolDefinition() {
  return {
    id: MODULE_ID,
    title: "Morelord Journeys",
    icon: "fa-solid fa-person-hiking",
    order: 10,
    visible: () => game.user?.isGM === true,
    onClick: openJourneysTool
  };
}

export function registerJourneysSceneTool() {
  addMorelordTool(journeysToolDefinition());
}
