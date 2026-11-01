# Morelord Journeys 0.6.0

Skill checks use the D&D 5e roll dialog, and Camp can open Morelord Downtime.

## What Changed

### Features

- Camp shows **Open Downtime** above **Continue** when Morelord Downtime is active. The button opens the Downtime dashboard through Downtime's public `open()` API so the GM can track a couple of hours of downtime while the party sets up camp. Selecting it does not spend those hours or advance Downtime Projects. The button stays hidden when Downtime is not active.
- Journeys documents how it reads Morelord Core shared Locations. A new travel day copies the expedition's stored place, or reports **On the Road** when none is stored. Completing a day sends that place, the day's personal activity hours, and whether the party arrived. Arrival leaves Core's current Location on the open Scene.

### Fixes

- Discovery, Navigation, foraging, and watch Perception checks call `actor.rollSkill`. Press On and sleep deprivation call `actor.rollSavingThrow`. Both use the D&D 5e configuration dialog, so effects, flags, dialog choices, and the system's modifier keys apply. The dialog stays closed only when those keys request it.
- Pace, extreme weather, divided watch attention, and a stopped pace on a deprivation save start that dialog at advantage or disadvantage. Those selections are passed through only when they apply, so they combine with the character's other modifiers and cancel in the normal way.
- Journey chat cards show one **Roll** button. The person who clicks it gets the dialog, including a GM rolling for someone who is offline. Journeys reads the total and the active d20 from the returned roll and keeps the existing outcome rules.
- The direct **Roll Navigation** action uses the same Survival dialog. Extreme weather starts it at disadvantage.
- Foraging, supply, watch Perception, Peaceful Rest, Press On, sleep, Discovery, Navigation, and day-encounter updates refresh the open Journeys window through Core's `api.ui.renderInBackground`. That refresh does not bring the window forward. Morelord Core 0.8.2 or later is required. If that function is missing, the same refresh uses `render({ force: false })`.

## Verification

`npm test` passed all 158 tests. That includes the Downtime availability and **Open Downtime** launch checks, reading an advantage roll's active d20, leaving `dialog.configure` unset, presetting extreme-weather disadvantage without sending `advantage: false`, opening the roll on the clicking player's client, creating chat requests with `modes: false`, and refreshing an open window through `api.ui.renderInBackground` with a `render({ force: false })` fallback. `api.ui.renderInBackground` is present on released Morelord Core 0.8.2. Core's design-system check was not run because this change does not add or restyle shared UI markup.

The dnd5e API was read from the system source, not guessed. `Actor5e#rollSkill(config, dialog, message)` and `rollSavingThrow(config, dialog, message)` return `Promise<D20Roll[]|null>` in 5.3.0 (the module minimum), 6.0.3 (the last Dev1 report), and 6.0.6 (the current release, 6 October 2026). This environment has no installed dnd5e system. `D20Roll.applyKeybindings` uses `config.event` with the default keys Shift (normal), Alt (advantage), and Control (disadvantage). Journeys leaves `dialog.configure` unset so those keys can skip the dialog.

No in-Foundry testing was run. There is no Foundry world in this environment, so Dev1 checks were not executed. `journeys.immediate-group-rolls` now confirms the D&D 5e dialog's Normal button before expecting the roll to finish. `journeys.grouped-roll-cards` expects one Roll button and no DIS or ADV buttons. Foundry's latest stable release is still 14.369 (8 October 2026). This change was not verified in Foundry, so `compatibility.verified` stays 14.369. Minimum 14 and maximum 14 are unchanged. No stored identifiers or campaign data were migrated or deleted. The manifest download URL still points at the published 0.5.0 zip; this change was not tagged or released.
