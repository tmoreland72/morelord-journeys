import { roleRollService } from "../services/role-roll-service.mjs";
import { JourneyOrchestrationApplication as BaseJourneyApplication } from "./journey-orchestration-app.mjs";

export class JourneyActionApplication extends BaseJourneyApplication {
  static DEFAULT_OPTIONS = {
    actions: {
      autoRoleSuccess: this.autoRoleSuccess,
      autoRoleFailure: this.autoRoleFailure
    }
  };

  static async autoRoleSuccess(event) {
    event.preventDefault();
    await this.resolveRole(true);
  }

  static async autoRoleFailure(event) {
    event.preventDefault();
    await this.resolveRole(false);
  }

  async resolveRole(succeeded) {
    try {
      await roleRollService.autoResolve(succeeded);
      await this.render({ force: true });
    } catch (error) {
      console.error("Morelord Journeys | Automatic role check resolution failed.", error);
      ui.notifications.error(error.message);
    }
  }
}
