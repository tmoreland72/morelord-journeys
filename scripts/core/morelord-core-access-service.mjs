import { EntitlementService } from "../services/entitlement-service.mjs";

export class MorelordCoreAccessService {
  async refresh({ quiet = true } = {}) {
    await EntitlementService.refresh({ quiet });
    return this.snapshot();
  }

  openAccount() {
    return EntitlementService.openAccount();
  }

  hasFeature(featureId) {
    return EntitlementService.hasFeature(featureId);
  }

  snapshot() {
    return EntitlementService.status();
  }
}
