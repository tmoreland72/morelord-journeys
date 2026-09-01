import test from "node:test";
import assert from "node:assert/strict";
import { createDayCompletionPayload, getJourneyTravelContext, parseTemporaryCapabilities, updateJourneyTravelContext } from "../scripts/domain/travel-context.mjs";

test("a Journey day defaults to On the Road with two activity hours", () => {
  const context = getJourneyTravelContext({ activityHoursPerDay: 2, currentDay: null });
  assert.equal(context.location.settlementType, "road");
  assert.equal(context.activityHours, 2);
});

test("Journey completion payload is stable and safe for optional consumers", () => {
  const journey = { id: "journey-1", status: "active", activityHoursPerDay: 4 };
  const day = { number: 3, pace: "normal", appliedProgressSteps: 3 };
  const payload = createDayCompletionPayload(journey, day);
  assert.equal(payload.idempotencyKey, "journey:journey-1:day:3");
  assert.equal(payload.downtimeHours, 4);
  assert.equal(payload.location.name, "On the Road");
});

test("temporary Journey capabilities are included without changing the Location", () => {
  const context = getJourneyTravelContext({
    activityHoursPerDay: 2,
    temporaryCapabilities: [{ type: "marketplace", tier: "rare", source: "traveling-merchant" }]
  });
  assert.equal(context.location.capabilities.length, 0);
  assert.deepEqual(context.temporaryCapabilities[0], {
    type: "marketplace", tier: "rare", specialty: null, source: "traveling-merchant"
  });
});

test("shared travel-context updater applies values to the active day", () => {
  const journey = updateJourneyTravelContext({ id: "j", currentDay: { number: 1 } }, {
    locationId: "neverwinter",
    activityHours: 6,
    temporaryCapabilities: parseTemporaryCapabilities("instructor:rare:draconic")
  });
  assert.equal(journey.currentDay.locationId, "neverwinter");
  assert.equal(journey.currentDay.activityHours, 6);
  assert.equal(journey.currentDay.temporaryCapabilities[0].specialty, "draconic");
});
