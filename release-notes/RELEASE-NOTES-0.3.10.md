# Morelord Journeys 0.3.10

## What Changed

### Fixes

- Players no longer see the Journeys toolbar button or open the GM expedition dashboard through the public API or a direct application call.
- Journey saves and clears explicitly require GM privileges. Players retain their character chat roll controls and public progress updates.
- Updated the GM manual and player guide to explain the access boundary.

## Verification

All 134 Journeys automated tests passed. The player access regression passed in verified Dev1 on Foundry VTT 14.368 / D&D5e 6.0.3 using Core's shared runner: toolbar visibility, rejected dashboard/API access, rejected save/clear, and unchanged journey state. The GM dashboard regression verifies retained access and actual Core layout rendering. Evidence is under `test/in-game-reports/2026-10-05-journey-permissions-*.json`. Foundry 14.368 is the latest stable build confirmed against the official release listing; supported bounds remain unchanged. Full GM gameplay and multiplayer roll workflows were not rerun for this permissions fix.
