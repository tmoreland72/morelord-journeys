import { assertSectionText } from "../../../morelord-core/scripts/testing/helper-text.js";

export const helperTextCheck = {
  id: "morelord-journeys.helper-text",
  async run() {
    const render = foundry.applications.handlebars.renderTemplate;
    for (const name of ["journey-settings", "journey-app"]) {
      const html = await render(`modules/morelord-journeys/templates/${name}.hbs`, { settings: { dc: {} }, access: {}, core: {}, packs: [], isPlanning: true });
      assertSectionText(html, '.ml-app p');
    }
  }
};
