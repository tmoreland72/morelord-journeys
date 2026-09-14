import { MODULE_ID } from "../domain/constants.mjs";
import { DAY_ENCOUNTER_DIE_SETTING, getDayEncounterDie } from "../core/journey-settings.mjs";
import { DAY_ENCOUNTER_DICE } from "../domain/encounter-rules.mjs";
import { DC_CONFIGURATION_SETTING, getDCConfiguration, SKIP_DICE_ANIMATION_SETTING, SUPPRESS_SLEEP_DEPRIVATION_EXHAUSTION_SETTING } from "../core/journey-settings.mjs";
import { EntitlementService } from "../services/entitlement-service.mjs";
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
    const dc = getDCConfiguration();
    return {
      ...context,
      settings: {
        suppressSleepDeprivationExhaustion: game.settings.get(MODULE_ID, SUPPRESS_SLEEP_DEPRIVATION_EXHAUSTION_SETTING),
        skipDiceAnimation: game.settings.get(MODULE_ID, SKIP_DICE_ANIMATION_SETTING),
        dc
      },
      dcGroups: {
        discovery: ["Very likely", "Likely", "Possible", "Unlikely", "Very unlikely"].map((label, index) => ({ label, index, value: dc.discovery[index] })),
        navigation: ["Simple", "Routine", "Normal", "Challenging", "Very challenging", "Extreme"].map((label, index) => ({ label, index, value: dc.navigation[index] })),
        foraging: ["Lush forest or meadow", "Productive woodland or grassland", "Typical mixed wilderness", "Traveled or heavily settled land", "Desert, tundra, or sparse badlands", "Barren or extreme environment"].map((label, index) => ({ label, index, value: dc.foraging[index] }))
      },
      dayEncounterDice: DAY_ENCOUNTER_DICE.map(faces => ({ faces, label: `d${faces}`, selected: faces === getDayEncounterDie() })),
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
      if (!game.user.isGM) throw new Error("Only the GM can change Journey settings.");
      const faces = Number(this.element.querySelector('[name="dayEncounterDie"]')?.value);
      if (!DAY_ENCOUNTER_DICE.includes(faces)) throw new Error("Choose a supported daytime encounter die.");
      await game.settings.set(MODULE_ID, DAY_ENCOUNTER_DIE_SETTING, faces);
      await game.settings.set(MODULE_ID, SUPPRESS_SLEEP_DEPRIVATION_EXHAUSTION_SETTING, Boolean(this.element.querySelector('[name="suppressSleepDeprivationExhaustion"]')?.checked));
      await game.settings.set(MODULE_ID, SKIP_DICE_ANIMATION_SETTING, Boolean(this.element.querySelector('[name="skipDiceAnimation"]')?.checked));
      const priorDC = getDCConfiguration();
      const readDC = (name, fallback) => {
        const value = Number(this.element.querySelector(`[name="${name}"]`)?.value);
        return Number.isInteger(value) && value >= 0 && value <= 50 ? value : fallback;
      };
      const dc = {
        discovery: priorDC.discovery.map((value, index) => readDC(`dc-discovery-${index}`, value)),
        navigation: priorDC.navigation.map((value, index) => readDC(`dc-navigation-${index}`, value)),
        foraging: priorDC.foraging.map((value, index) => readDC(`dc-foraging-${index}`, value)),
        pressOn: readDC("dc-pressOn", priorDC.pressOn),
        hungerBase: readDC("dc-hungerBase", priorDC.hungerBase),
        hungerIncrease: readDC("dc-hungerIncrease", priorDC.hungerIncrease),
        sleepBase: readDC("dc-sleepBase", priorDC.sleepBase),
        sleepDeprivationBase: readDC("dc-sleepDeprivationBase", priorDC.sleepDeprivationBase),
        sleepDeprivationIncrease: readDC("dc-sleepDeprivationIncrease", priorDC.sleepDeprivationIncrease)
      };
      await game.settings.set(MODULE_ID, DC_CONFIGURATION_SETTING, dc);
      ui.notifications.info("Morelord Journeys settings saved.");
      await this.close();
    } finally {
      target.disabled = false;
    }
  }
}
