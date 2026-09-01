# Journeys Travel and Downtime Integration

Journeys owns travel-day context. It does not advance Downtime Projects directly and remains fully functional when Morelord Downtime is absent.

## Public API

The API is available at `game.modules.get("morelord-journeys").api.travel` and `MorelordJourneys.travel`.

- `getContext()` returns the current shared Location (or virtual `On the Road`), personal activity hours, and temporary Journey capabilities.
- `updateContext({ locationId, activityHours, temporaryCapabilities })` is GM-only, persists the context, updates an active day, and emits `morelordJourneys.contextChanged`.

## Day completion hook

After the completed Journey is saved, Journeys calls:

```js
Hooks.callAll("morelordJourneys.dayComplete", {
  journeyId,
  day,
  idempotencyKey: `journey:${journeyId}:day:${day}`,
  locationId,
  location,
  downtimeHours,
  temporaryCapabilities,
  metadata: { pace, appliedProgressSteps, arrived }
});
```

Consumers must treat `idempotencyKey` as stable. Downtime will use it to reject duplicate authoritative day advancement.

Temporary capabilities enrich the day's context without mutating the persistent shared Location. Examples include a traveling merchant, caravan workshop, or traveling instructor.
