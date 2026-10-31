export const DOWNTIME_MODULE_ID = "morelord-downtime";

export class DowntimeOpenIntegration {
  get module() {
    return game.modules.get(DOWNTIME_MODULE_ID) ?? null;
  }

  get api() {
    return this.module?.active ? this.module.api ?? globalThis.MorelordDowntime ?? null : null;
  }

  isAvailable() {
    return typeof this.api?.open === "function";
  }

  async open() {
    if (!this.isAvailable()) {
      throw new Error("Morelord Downtime is not available.");
    }
    if (!game.user.isGM) {
      throw new Error("Only the GM can open Morelord Downtime.");
    }
    return this.api.open.call(this.api);
  }

  snapshot() {
    if (!this.isAvailable()) {
      return {
        available: false,
        moduleId: DOWNTIME_MODULE_ID,
        active: Boolean(this.module?.active)
      };
    }

    return {
      available: true,
      moduleId: DOWNTIME_MODULE_ID,
      active: true
    };
  }
}
