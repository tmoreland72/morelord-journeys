import { assert } from "../../../morelord-core/scripts/testing/in-game.js";
import { watchPerceptionTitle, repairWatchRequestLabel } from "../services/camp-perception-roll-service.mjs";

export const plannerFooterCheck = {
  id: "journeys.planner-footer-and-watch-label",
  async run() {
    assert(game.world.id === "dev1", "This check requires Dev1.");
    const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
    const clicked = [];
    class PlannerFixture extends HandlebarsApplicationMixin(ApplicationV2) {
      static DEFAULT_OPTIONS = {
        id: "journeys-planner-footer-test", classes: ["ml-window", "ml-journeys-window"],
        position: { width: 720, height: 480 },
        actions: {
          saveJourneyDefaults: () => clicked.push("save"),
          createJourney: () => clicked.push("create")
        }
      };
      static PARTS = { body: { template: "modules/morelord-journeys/templates/journey-app.hbs" } };
      async _prepareContext() { return { hasJourney: false }; }
    }
    const app = new PlannerFixture();
    try {
      await app.render({ force: true });
      const root = app.element;
      const footer = root.querySelector(".window-content > .ml-page-footer");
      const body = root.querySelector(".ml-page-body");
      assert(footer && body, "Planner actions must be detached into Core's footer.");
      for (const width of [720, 400]) {
        app.setPosition({ width, height: 480 });
        await new Promise(resolve => requestAnimationFrame(resolve));
        const before = footer.getBoundingClientRect().top;
        body.scrollTop = body.scrollHeight;
        await new Promise(resolve => requestAnimationFrame(resolve));
        assert(body.scrollTop > 0, "Planner fixture must scroll.");
        assert(Math.abs(footer.getBoundingClientRect().top - before) < 2, "Footer moved with planner scrolling.");
        for (const button of footer.querySelectorAll("button")) {
          const rect = button.getBoundingClientRect();
          assert(rect.top >= root.getBoundingClientRect().top && rect.bottom <= root.getBoundingClientRect().bottom,
            "Planner action is clipped.");
        }
      }
      footer.querySelector('[data-action="saveJourneyDefaults"]').click();
      footer.querySelector('[data-action="createJourney"]').click();
      assert(clicked.join() === "save,create", "Detached footer actions must retain Foundry event routing.");
      const title = watchPerceptionTitle("Watch 1 (0–2 hours after camp begins)");
      assert(title === "Watch Perception - Watch 1 (0–2 hours after camp begins)", "Watch label contains a broken separator.");
      const html = MorelordCore.chatRequests.html({ title: "Watch Discovery Checks", entries: {
        watch: { title, modes: true, choices: [], dc: null }
      } });
      assert(html.includes(title) && !html.includes("\uFFFD"), "Rendered watch card contains a broken character.");
      const oldCard = document.createElement("div");
      oldCard.innerHTML = html.replace("Watch Perception - ", "Watch Perception \uFFFD ");
      repairWatchRequestLabel({ getFlag: () => ({ type: "journeys.watch" }) }, oldCard);
      assert(oldCard.textContent.includes(title) && !oldCard.textContent.includes("\uFFFD"), "Previously posted watch cards must display the corrected label.");
    } finally { await app.close(); }
  }
};
