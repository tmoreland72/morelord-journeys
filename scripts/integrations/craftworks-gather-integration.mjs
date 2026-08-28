export const CRAFTWORKS_MODULE_ID = "morelord-craftworks";

export class CraftworksGatherIntegration {
  get module() {
    return game.modules.get(CRAFTWORKS_MODULE_ID) ?? null;
  }

  get api() {
    return this.module?.active ? this.module.api ?? globalThis.MorelordCraftworks ?? null : null;
  }

  isAvailable() {
    return Boolean(this.api?.open ?? this.api?.openCraftworks ?? this.api?.openGather);
  }

  async open() {
    if (!this.isAvailable()) {
      throw new Error("Morelord Craftworks is not available.");
    }
    if (!game.user.isGM) {
      throw new Error("Only the GM can launch Morelord Craftworks.");
    }
    const open = this.api.open ?? this.api.openCraftworks ?? this.api.openGather;
    return open.call(this.api);
  }

  snapshot() {
    if (!this.isAvailable()) {
      return {
        available: false,
        moduleId: CRAFTWORKS_MODULE_ID,
        active: Boolean(this.module?.active)
      };
    }

    return {
      available: true,
      moduleId: CRAFTWORKS_MODULE_ID,
      active: true,
      sceneId: canvas.scene?.id ?? null,
      sceneName: canvas.scene?.name ?? null
    };
  }
}
