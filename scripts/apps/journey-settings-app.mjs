import { MODULE_ID } from "../domain/constants.mjs";
import { EntitlementService } from "../services/entitlement-service.mjs";
const SETTINGS = Object.freeze({
  ENCOUNTER_DIE: "encounterDie",
  ENCOUNTER_ROLL_MODE: "encounterRollMode",
  PLAYER_ENCOUNTER_VISIBILITY: "playerEncounterVisibility"
});
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class JourneySettingsApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "morelord-journeys-settings",
      classes: ["ml-window", "ml-journeys-module", "ml-journeys-settings-window"],
    tag: "section",
    window: { title: "Morelord Journeys Settings", icon: "fa-solid fa-person-hiking", resizable: true },
    position: { width: 720, height: 680 },
    actions: { manageAccount: this.manageAccount, refreshAccess: this.refreshAccess, save: this.save }
  };

  static PARTS = { content: { template: `modules/${MODULE_ID}/templates/journey-settings.hbs` } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const access = EntitlementService.status();
    return {
      ...context,
      settings: {
        encounterDie: game.settings.get(MODULE_ID, SETTINGS.ENCOUNTER_DIE),
        encounterRollMode: game.settings.get(MODULE_ID, SETTINGS.ENCOUNTER_ROLL_MODE),
        playerEncounterVisibility: game.settings.get(MODULE_ID, SETTINGS.PLAYER_ENCOUNTER_VISIBILITY)
      },
      access: {
        ...access,
        tierLabel: access.tier === "champion" ? "Tools Champion" : access.tier === "premium" ? "Tools Premium" : "Standard",
        validatedAtLabel: access.validatedAt ? new Date(access.validatedAt).toLocaleString() : null
      }
    };
  }

  static manageAccount(event) {
    event.preventDefault();
    EntitlementService.openAccount();
  }

  static async refreshAccess(event, target) {
    event.preventDefault();
    target.disabled = true;
    try {
      await EntitlementService.refresh({ quiet: false });
      await this.render({ force: true });
    } finally {
      target.disabled = false;
    }
  }

  static async save(event, target) {
    event.preventDefault();
    target.disabled = true;
    try {
      const values = {
        [SETTINGS.ENCOUNTER_DIE]: this.element.querySelector(`[name="${SETTINGS.ENCOUNTER_DIE}"]`)?.value,
        [SETTINGS.ENCOUNTER_ROLL_MODE]: this.element.querySelector(`[name="${SETTINGS.ENCOUNTER_ROLL_MODE}"]`)?.value,
        [SETTINGS.PLAYER_ENCOUNTER_VISIBILITY]: this.element.querySelector(`[name="${SETTINGS.PLAYER_ENCOUNTER_VISIBILITY}"]`)?.value
      };
      const allowed = {
        [SETTINGS.ENCOUNTER_DIE]: new Set(["d4", "d6", "d8", "d10", "d12", "d20"]),
        [SETTINGS.ENCOUNTER_ROLL_MODE]: new Set(["gm", "players"]),
        [SETTINGS.PLAYER_ENCOUNTER_VISIBILITY]: new Set(["publicroll", "gmroll", "blindroll"])
      };
      if (Object.entries(values).some(([key, value]) => !allowed[key].has(value))) {
        ui.notifications.error("One or more Journeys settings are invalid.");
        return;
      }
      for (const [key, value] of Object.entries(values)) await game.settings.set(MODULE_ID, key, value);
      ui.notifications.info("Morelord Journeys settings saved.");
      await this.close();
    } finally {
      target.disabled = false;
    }
  }
}
