# Morelord Journeys 0.3.8

## What Changed

### Added

- Send Long Rest Buttons after Sleep & Shelter resolves, using Core's shared chat requests for eligible travelers with GM fallback and without repeating Exhaustion recovery.

### Fixed

- Planner Save as Default and Create Journey actions remain visible in the shared footer while setup content scrolls.
- Watch Perception labels use a readable dash, including previously posted requests when rendered.
- Section subtitles and explanatory paragraphs follow Core's shared text styling.

## Compatibility and verification

Requires Morelord Core 0.3.15. Verified on Foundry VTT 14.368 with D&D5e 6.0.3 in Dev1. Automated tests cover long-rest eligibility, stale requests, and rest options; live checks cover planner/footer behavior and shared controls. Supported Foundry bounds remain unchanged.
