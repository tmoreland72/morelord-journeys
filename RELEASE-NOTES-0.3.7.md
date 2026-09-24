# Morelord Journeys 0.3.7

Grouped travel rolls and accurate journey progress.

## What Changed

### Improvements

- Use Core grouped party requests for encounter, discovery, navigation, foraging, Press On, and sleep-deprivation checks, with offline-player GM fallback and independent character DCs.
- Show Completed immediately and keep other roll controls usable; delay derived outcomes until dice animations finish. Persist evaluated rolls for recovery and serialize final updates against current journey state.
- Use Request Encounters Roll, Request Discovery Check, Request Navigation Check, Request Foraging Rolls, and Request Sleep Deprivation Roll labels. Remove foraging Resend, Fail, and Succeed controls.
- Restore direct private GM night-encounter rolls.
- Separate completed calendar days from route progress so the current day, remaining travel, and total estimate agree.

## Compatibility and verification

132 automated tests passed. Core design-system checks passed. Foundry 14.368 remains the latest stable release and the verified build; supported minimum/maximum bounds are unchanged. Existing Dev1 regression records cover the previously implemented workflows on Foundry 14.368 / D&D5e 6.0.3. No new in-Foundry testing was run for this release at the user’s request.
