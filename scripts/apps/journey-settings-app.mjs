import { MODULE_ID } from "../domain/constants.mjs";
import { NIGHT_ENCOUNTERS_SETTING, PHASE_SETTING_KEYS, SLEEP_AND_SHELTER_SETTING, SUPPRESS_SLEEP_DEPRIVATION_EXHAUSTION_SETTING } from "../core/journey-settings.mjs";
import { EntitlementService } from "../services/entitlement-service.mjs";
const SETTINGS = Object.freeze({
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
        encounterRollMode: game.settings.get(MODULE_ID, SETTINGS.ENCOUNTER_ROLL_MODE),
        playerEncounterVisibility: game.settings.get(MODULE_ID, SETTINGS.PLAYER_ENCOUNTER_VISIBILITY),
        phases: Object.fromEntries(Object.entries(PHASE_SETTING_KEYS).map(([phase, key]) => [phase, game.settings.get(MODULE_ID, key)]))
        , suppressSleepDeprivationExhaustion: game.settings.get(MODULE_ID, SUPPRESS_SLEEP_DEPRIVATION_EXHAUSTION_SETTING),
        enableNightEncounters: game.settings.get(MODULE_ID, NIGHT_ENCOUNTERS_SETTING),
        enableSleepAndShelter: game.settings.get(MODULE_ID, SLEEP_AND_SHELTER_SETTING)
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
        [SETTINGS.ENCOUNTER_ROLL_MODE]: this.element.querySelector(`[name="${SETTINGS.ENCOUNTER_ROLL_MODE}"]`)?.value,
        [SETTINGS.PLAYER_ENCOUNTER_VISIBILITY]: this.element.querySelector(`[name="${SETTINGS.PLAYER_ENCOUNTER_VISIBILITY}"]`)?.value
      };
      const allowed = {
        [SETTINGS.ENCOUNTER_ROLL_MODE]: new Set(["gm", "players"]),
        [SETTINGS.PLAYER_ENCOUNTER_VISIBILITY]: new Set(["publicroll", "gmroll", "blindroll"])
      };
      if (Object.entries(values).some(([key, value]) => !allowed[key].has(value))) {
        ui.notifications.error("One or more Journeys settings are invalid.");
        return;
      }
      for (const [key, value] of Object.entries(values)) await game.settings.set(MODULE_ID, key, value);
      for (const [phase, key] of Object.entries(PHASE_SETTING_KEYS)) {
        await game.settings.set(MODULE_ID, key, Boolean(this.element.querySelector(`[name="phase-${phase}"]`)?.checked));
      }
      await game.settings.set(MODULE_ID, SUPPRESS_SLEEP_DEPRIVATION_EXHAUSTION_SETTING, Boolean(this.element.querySelector('[name="suppressSleepDeprivationExhaustion"]')?.checked));
      await game.settings.set(MODULE_ID, NIGHT_ENCOUNTERS_SETTING, Boolean(this.element.querySelector('[name="enableNightEncounters"]')?.checked));
      await game.settings.set(MODULE_ID, SLEEP_AND_SHELTER_SETTING, Boolean(this.element.querySelector('[name="enableSleepAndShelter"]')?.checked));
      ui.notifications.info("Morelord Journeys settings saved.");
      await this.close();
    } finally {
      target.disabled = false;
    }
  }
}
