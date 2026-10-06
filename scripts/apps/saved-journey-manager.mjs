import { MODULE_ID } from "../domain/constants.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SavedJourneyManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["ml-window", "ml-location-manager"], tag: "form",
    window: { title: "Saved Journeys", icon: "fa-solid fa-route", resizable: true },
    position: { width: 700, height: 440 }, form: { closeOnSubmit: false },
    actions: { edit: this.edit, save: this.save, delete: this.delete, choose: this.choose }
  };
  static PARTS = { content: { template: "modules/morelord-journeys/templates/saved-journey-manager.hbs" } };
  selectedId = null;
  _canRender(options) {
    if (!game.user.isGM) throw new Error("Only the GM can manage saved journeys.");
    return super._canRender(options);
  }
  constructor({ choose, onChange, ...options } = {}) { super(options); this.chooseJourney = choose; this.onChange = onChange; }
  async _prepareContext() {
    const entries = game.settings.get(MODULE_ID, "savedJourneys")?.entries ?? [];
    if (!entries.some(entry => entry.id === this.selectedId)) this.selectedId = entries[0]?.id ?? null;
    const draft = entries.find(entry => entry.id === this.selectedId);
    return { entries: entries.map(entry => ({ ...entry, selected: entry.id === this.selectedId })), draft, fields: draft?.setup?.fields };
  }
  static edit(event, target) { event.preventDefault(); this.selectedId = target.dataset.journeyId; return this.render({ force: true }); }
  static async save(event) {
    event.preventDefault();
    try {
      if (!game.user.isGM) throw new Error("Only the GM can save journeys.");
      const name = this.element.querySelector('[name="name"]').value.trim();
      if (!name) throw new Error("Enter a journey name.");
      const stored = structuredClone(game.settings.get(MODULE_ID, "savedJourneys"));
      const entry = stored.entries.find(entry => entry.id === this.selectedId);
      if (!entry) throw new Error("This saved journey no longer exists.");
      entry.name = name;
      await game.settings.set(MODULE_ID, "savedJourneys", stored);
      await this.close();
    } catch (error) { ui.notifications.error(error.message); }
  }
  static async delete(event) {
    event.preventDefault();
    try {
      if (!game.user.isGM) throw new Error("Only the GM can delete saved journeys.");
      const stored = structuredClone(game.settings.get(MODULE_ID, "savedJourneys"));
      stored.entries = stored.entries.filter(entry => entry.id !== this.selectedId);
      await game.settings.set(MODULE_ID, "savedJourneys", stored);
      this.onChange?.();
      await this.close();
    } catch (error) { ui.notifications.error(error.message); }
  }
  static async choose(event) {
    event.preventDefault();
    try {
      if (!game.user.isGM) throw new Error("Only the GM can choose journeys.");
      const entry = game.settings.get(MODULE_ID, "savedJourneys")?.entries?.find(entry => entry.id === this.selectedId);
      if (!entry) throw new Error("This saved journey no longer exists.");
      await this.chooseJourney(structuredClone(entry));
      await this.close();
    } catch (error) { ui.notifications.error(error.message); }
  }
}
