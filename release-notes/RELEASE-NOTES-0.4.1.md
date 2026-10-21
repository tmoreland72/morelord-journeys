# Morelord Journeys 0.4.1

A night encounter duration of 0 hours does not interrupt the long rest.

## What Changed

### Fixes

- **Duration (hours)** on a rolled night encounter can be 0. Zero hours does not interrupt the long rest: no recovery hour is added, interrupted time is not lost, and rest results say the long rest was not interrupted. The control still defaults to 1 hour, changes in whole hours from 0 through 8, and does not allow typing. Durations of 1 hour or more are unchanged.

## Compatibility and verification

Node tests that do not import Morelord Core passed, including the zero-hour and one-hour rest cases (105 passed). Thirteen suites failed to load because Morelord Core is not present in this environment (`ERR_MODULE_NOT_FOUND` for `/morelord-core`). This repository expects Core as a sibling checkout; its repository and manifest were not accessible here, so Core could not be installed or linked. Core's design-system check was not run.

No in-Foundry testing was run. There is no Foundry world in this environment, so Dev1 checks including `journeys.night-encounter-controls` were not executed. Foundry's latest stable release is 14.369 (8 October 2026). This module was not verified on 14.369, so `compatibility.verified` remains 14.368, the last recorded verified build. Minimum 14 and maximum 14 are unchanged. No stored identifiers or campaign data were migrated or deleted.
