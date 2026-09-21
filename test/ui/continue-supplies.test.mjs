import test from "node:test";
import assert from "node:assert/strict";
import { createJourney } from "../../scripts/domain/journey.mjs";
import { createRoute } from "../../scripts/domain/route.mjs";
import { SupplyManifestService } from "../../scripts/services/supply-manifest-service.mjs";

globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: cls => cls } } };
const { supplyConsequenceService } = await import("../../scripts/services/supply-consequence-service.mjs");
const { JourneyForagingApplication: App } = await import("../../scripts/apps/journey-foraging-app.mjs");
const { JourneyFinalApplication: Base } = await import("../../scripts/apps/journey-final-app.mjs");

test("Continue consumes once, advances when complete, and waits for shortage saves", async () => {
  const originalBuild = SupplyManifestService.prototype.build;
  const originalBegin = supplyConsequenceService.begin;
  const originalAdvance = Base.advancePhase;
  const errors = [];
  let stored, quantity, updates, advances, shortage;
  const app = { element: { querySelector: () => null, querySelectorAll: () => [] }, render: async () => {} };
  const event = { preventDefault() {} };
  globalThis.ui = { notifications: { error: message => errors.push(message) } };
  globalThis.game = { user: { isGM: true }, settings: {
    get: () => structuredClone(stored),
    set: async (module, key, value) => { stored = structuredClone(value); }
  } };
  globalThis.fromUuid = async () => ({ name: "Rations", system: { quantity }, update: async data => { quantity = data["system.quantity"]; updates++; } });
  SupplyManifestService.prototype.build = async () => ({ items: [{ category: "food", itemUuid: "ration", sourceActorUuid: "a", availableQuantity: quantity }] });
  supplyConsequenceService.begin = async () => {
    stored.currentDay.supplyConsequences ??= { resolved: !shortage };
  };
  Base.advancePhase = async () => { advances++; };
  try {
    for (shortage of [false, true]) {
      stored = createJourney({ id: "test", route: createRoute({ id: "route", origin: { name: "A" }, destination: { name: "B" }, lengthSteps: 6 }), travelers: [{ actorUuid: "a", name: "A" }] });
      stored.phase = "foraging";
      stored.currentDay = { foragingResults: [{}], pendingForagingRolls: [], foragingResolution: { foodActorUuids: ["a"], successfulActorUuids: ["a"] } };
      quantity = 3; updates = 0; advances = 0;
      await Promise.all([App.advancePhase.call(app, event), App.advancePhase.call(app, event)]);
      assert.equal(quantity, 2);
      assert.equal(updates, 1);
      assert.equal(advances, shortage ? 0 : 1);
      assert.ok(stored.currentDay.supplyResolution);
      if (shortage) {
        stored.currentDay.supplyConsequences.resolved = true;
        await App.advancePhase.call(app, event);
        assert.equal(advances, 1);
        assert.equal(updates, 1);
      }
      await App.consumeTravelSupplies.call(app, event);
      assert.equal(updates, 1, "Reopened saved results cannot consume twice");
    }
    stored.currentDay.pendingForagingRolls = [{}];
    await App.advancePhase.call(app, event);
    assert.equal(advances, 1);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Resolve every traveler's foraging/);
  } finally {
    SupplyManifestService.prototype.build = originalBuild;
    supplyConsequenceService.begin = originalBegin;
    Base.advancePhase = originalAdvance;
  }
});
