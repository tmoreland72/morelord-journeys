# Morelord Journeys 0.4.0

## What Changed

### Features

- Added named Saved Journeys. Use **Save Journey** to keep a planner setup and **Choose Saved Journey** to open its manager. **Select Journey** fills a fresh planner; **Save Journey** renames the selected preset; **Delete** removes it.
- Saved setups retain route, duration, ratings, enabled steps, party, individual Long Rest hours, and roles. They do not retain inventory quantities or expedition progress. Supplies come from current actor inventories when creating the new journey. Named setups remain independent of **Save as Default**.
- Saved Journeys uses Core's manager layout, responsive grid, selection states, controls, and fixed page footer. GM access is enforced for the dashboard and manager.

### Fixes

- Disabled and skipped steps no longer post completion cards or appear in the displayed step sequence/recent activity. Completion numbering follows included steps, including Stopped pace. Saving removes identified stale cards for that journey and renumbers those that remain; unidentified historical cards are retained.
- Each accepted night encounter now has one timed rest interruption per traveler. **Duration (hours)** defaults to one, changes in whole-hour steps, and stays within one to eight hours; direct typing is disabled.
- **Reject encounter** removes the selected encounter and interruption while retaining its dice. Watch Perception requests remain when another accepted encounter still needs that watch; otherwise pending requests are retired.
- Night encounter summaries appear after Outcome Details. Pending watch checks now produce their intended continuation error without masking it or reporting it twice.
- Reordered the planner to Journey Distance, Expedition Party, Route Ratings, Expedition Roles, and Supply Manifest. Updated the documentation landing page, README, GM manual, and player guide version metadata.

## Verification

All 138 Journeys automated tests and Core's design-system boundary check passed. In verified Dev1 on Foundry VTT 14.368 / D&D5e 6.0.3, the GM suite passed seven checks, the skipped-step suite passed five, and the player suite passed four with one expected GM-only skip. Live checks cover saved setup creation/selection/renaming/deletion, unchanged world defaults, GM/player access, night duration controls and encounter rejection, pending-watch error reporting, and skipped/stale completion cards. Test settings and disposable actors/messages were restored or removed.

Saved Journeys was visually inspected in dark and light themes at 700px and 400px window widths with actual Foundry/Core styles loaded; narrow content stacks and the action footer remains visible. Reports and captures are retained in `test/in-game-reports/2026-10-06-*`. Full 200% zoom, all gameplay phases, and multiplayer disconnect races were not rerun.

Foundry's official release listing confirms 14.368 remains the latest stable build. The manifest and Foundry release metadata retain minimum 14, maximum 14, and verified 14.368. No stored identifiers or existing campaign data were migrated or deleted.
