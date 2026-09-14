import { SCHEMA_VERSION } from "./constants.mjs";
import {
  JourneyValidationError,
  optionalDC,
  requireInteger,
  requireString
} from "./validation.mjs";

export function validateRoute(route) {
  const issues = [];
  requireString(route?.id, "id", issues);
  requireString(route?.name, "name", issues);
  requireString(route?.origin?.name, "origin.name", issues);
  requireString(route?.destination?.name, "destination.name", issues);
  requireInteger(route?.lengthSteps, "lengthSteps", issues, 1);
  requireInteger(route?.danger, "danger", issues);
  optionalDC(route?.discoveryDC, "discoveryDC", issues);
  optionalDC(route?.resourcesDC, "resourcesDC", issues);
  optionalDC(route?.navigationDC, "navigationDC", issues);

  if (issues.length) throw new JourneyValidationError("Route is invalid", issues);
  return route;
}

export function createRoute(data) {
  return validateRoute({
    id: data.id,
    name: data.name || `${data.origin?.name ?? ""} → ${data.destination?.name ?? ""}`,
    origin: structuredClone(data.origin),
    destination: structuredClone(data.destination),
    description: data.description ?? "",
    playerDescription: data.playerDescription ?? "",
    lengthSteps: data.lengthSteps,
    danger: data.danger ?? 0,
    discoveryDC: data.discoveryDC ?? null,
    resourcesDC: data.resourcesDC ?? null,
    navigationDC: data.navigationDC ?? null,
    terrain: [...(data.terrain ?? [])],
    traffic: ["ordinary", "high"].includes(data.traffic) ? data.traffic : "ordinary",
    encounterTableUuid: data.encounterTableUuid ?? null,
    discoveryTableUuid: data.discoveryTableUuid ?? null,
    weatherTableUuid: data.weatherTableUuid ?? null,
    modifiers: structuredClone(data.modifiers ?? []),
    schemaVersion: SCHEMA_VERSION
  });
}
