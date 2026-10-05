# Morelord Journeys 0.3.0

Morelord Journeys 0.3.0 adds shared travel context for locations, personal activity time, and optional integrations with other Morelord modules.

## Added

- Added a GM-managed travel context with a shared Location and configurable personal activity hours for each travel day.
- Added temporary travel capabilities for services available only while the current Journey context is active.
- Added a public Journeys travel-context API for optional module integrations.
- Added a duplicate-safe `morelordJourneys.dayComplete` hook containing the completed day, travel progress, Location, activity hours, and temporary capabilities.
- Added documentation and automated coverage for the travel and Downtime integration contract.

## Improvements

- Preserved travel context on newly started days and in completed-day payloads.
- Added direct access to Morelord Core Location management from the Journey interface.
- Added environment-file guidance for the standard Morelord release workflow.
