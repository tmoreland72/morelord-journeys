export const CRAFTWORKS_MODULE_ID = "morelord-craftworks";

export class CraftworksGatherIntegration {
  get module() {
    return game.modules.get(CRAFTWORKS_MODULE_ID) ?? null;
  }

  get api() {
    return this.module?.active ? this.module.api ?? globalThis.MorelordCraftworks ?? null : null;
  }

  isAvailable() {
    return Boolean(this.api?.openGather);
  }

  async open() {
    if (!this.isAvailable()) {
      throw new Error("Morelord Craftworks Gather is not available.");
    }
    if (!game.user.isGM) {
      throw new Error("Only the GM can initiate gathering.");
    }
    return this.api.openGather();
  }

  snapshot() {
    if (!this.isAvailable()) {
      return {
        available: false,
        moduleId: CRAFTWORKS_MODULE_ID,
        active: Boolean(this.module?.active)
      };
    }

    const records = this.api.gather?.getSceneGatherRecords?.() ?? {};
    return {
      available: true,
      moduleId: CRAFTWORKS_MODULE_ID,
      active: true,
      sceneId: canvas.scene?.id ?? null,
      sceneName: canvas.scene?.name ?? null,
      gatherRecordCount: Object.keys(records).length
    };
  }
}
