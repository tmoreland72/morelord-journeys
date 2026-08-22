import { getActiveJourney, saveActiveJourney } from "../foundry/settings-repository.mjs";
import { JourneyRoleRefinementApplication as BaseJourneyApplication } from "./journey-role-refinement-app.mjs";

const value = (element, name) => element.querySelector(`[name="${name}"]`)?.value ?? "";

export class JourneyRoleApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = {
    actions: { saveRoles: this.saveRoles }
  };

  static async saveRoles(event) {
    event.preventDefault();
    const journey = await getActiveJourney();
    journey.roles = {
      navigatorUuid: value(this.element, "activeNavigatorUuid"),
      observerUuid: value(this.element, "activeObserverUuid")
    };
    await saveActiveJourney(journey);
    ui.notifications.info("Expedition roles updated.");
    await this.render({ force: true });
  }
}
