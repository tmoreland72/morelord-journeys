import { MODULE_ID } from "../domain/constants.mjs";

export const CORE_MODULE_ID = "morelord-core";
export const PRODUCT_SLUG = MODULE_ID;
const PREMIUM_TIERS = new Set(["premium", "tools-premium", "tools_premium", "champion"]);

const normalize = value => String(value ?? "").trim().toLowerCase();

export class EntitlementService {
  static get coreModule() { return game.modules.get(CORE_MODULE_ID) ?? null; }
  static get api() { return this.coreModule?.active ? this.coreModule.api ?? null : null; }
  static isCoreActive() { return Boolean(this.api); }
  static isConnected() { return Boolean(this.api?.isConnected?.()); }
  static getTier() { return this.api?.getTier?.(PRODUCT_SLUG) ?? "standard"; }
  static getEntitlements() { return this.api?.getEntitlements?.(PRODUCT_SLUG) ?? null; }

  static hasEntitlement(entitlementId) {
    const target = normalize(entitlementId);
    const values = this.getEntitlements()?.entitlements ?? [];
    return Array.from(values).some(value => {
      const id = typeof value === "string" ? value : value?.id ?? value?.key ?? value?.slug;
      return normalize(id) === target;
    });
  }

  static hasPremiumAccess() {
    return PREMIUM_TIERS.has(normalize(this.getTier()));
  }

  static hasFeature(featureKey) {
    if (this.api?.hasFeature?.(featureKey, PRODUCT_SLUG)) return true;
    if (this.hasEntitlement(featureKey)) return true;
    return false;
  }

  static async refresh({ quiet = true } = {}) {
    if (!this.api?.refresh) return null;
    try { return await this.api.refresh(PRODUCT_SLUG, { quiet }); }
    catch (error) {
      console.warn("Morelord Journeys | Core entitlement refresh unavailable.", error);
      if (!quiet) ui.notifications.error(error?.message ?? "Journeys access could not be refreshed.");
      return null;
    }
  }

  static openAccount() {
    if (this.api?.open) return this.api.open();
    ui.notifications.warn("Morelord Core must be enabled before a Morelord account can be connected.");
    return null;
  }

  static status() {
    const entitlements = this.getEntitlements();
    return {
      coreActive: this.isCoreActive(), connected: this.isConnected(),
      premium: this.hasPremiumAccess(), tier: this.getTier(),
      validatedAt: entitlements?.validatedAt ?? null, expiresAt: entitlements?.expiresAt ?? null
    };
  }
}
