# Morelord Journeys 0.3.2

Journeys now uses consistent Morelord section layouts, clearer character identities, and automatic success for zero-DC checks. Requires Morelord Core 0.3.4 or later.

## What Changed

### Improvements

- Align planning and travel steps with shared Morelord section cards, headings, controls, and spacing.
- Show circular character portraits alongside names throughout party assignments, checks, supplies, and outcomes.
- Improve Supply Manifest readability with body-size names and spacious item rows.
- Retain planner and journey-step defaults and improve camp watch assignment controls.

### Fixed

- Resolve zero-DC checks automatically without asking players to roll, including sleep checks after equipment modifiers.
- Preserve Long Rest requirements, ordinary foraging rewards, and supply consequences when checks succeed automatically.
- Correct camp watch sleep-hour accounting and preserve assignments when camp controls change.

## Validation

- Journeys and Core automated tests pass.
- Mock browser checks cover planning and travel steps at wide and narrow window sizes.
- User reviewed the Journeys interface before release.
