# Morelord Journeys 0.1.0

Morelord Journeys 0.1.0 is the first public release of the structured travel and expedition workflow for Foundry VTT v14 and D&D 5e.

## What Changed

### Added

- Added an eight-phase travel-day workflow covering weather, pace, encounters, discovery, foraging, navigation, pressing on, and camp.
- Added optional weather generation with rerolls, cold-weather detection, and journey-extending extreme-weather delays.
- Added whole-day journey progress with revised estimates such as “2 of 6 travel days (originally planned for 4 days).”
- Added socket-driven player roll requests for expedition roles, encounters, foraging, shortage saves, and camp-watch Perception checks.
- Added inventory-backed supply tracking for rations, `Water (Pint)`, tents, bedrolls, and blankets across party and traveler inventories.
- Added persistent camp watch order, automatic sleep and shelter defaults, private watch and sleep rolls, and explicit sleep consequences.
- Added Morelord Encounters and Morelord Craftworks integration buttons where those actions are relevant.
- Added an Expedition Log containing phase names and recorded results.

### Improvements

- Expedition roles now appear only during the phases where they are needed and save automatically.
- Supply manifests refresh whenever Journeys is opened and can still be refreshed manually.
- Completed phase indicators use solid orange circles with checkmarks.
- Journey configuration, expedition layout, action emphasis, and supply-source presentation were streamlined.

### Fixed

- Fixed completed travel days being displayed as confusing fractional days.
- Fixed camp-watch buttons becoming disabled when another watch assignment changed.
- Fixed contained `Water (Pint)` inventory quantities not being recognized or consumed correctly.
- Fixed a silent expedition-log render failure that prevented the Journeys window from opening.

## Notes

- Foundry VTT v14 and D&D 5e 5.3 or later are required.
- Morelord Core 0.1.0 or later is required.
- Morelord Encounters is recommended, and Morelord Craftworks integration is optional.
