# Morelord Journeys 0.5.1

Skill checks and Constitution saves use the D&D 5e roll dialog, and chat cards keep a single Roll button.

## What Changed

### Fixes

- Discovery, Navigation, foraging, and watch Perception checks call `actor.rollSkill`. Press On and sleep deprivation call `actor.rollSavingThrow`. Both use the D&D 5e configuration dialog, so effects, flags, dialog choices, and the system's modifier keys apply. The dialog stays closed only when those keys request it.
- Pace, extreme weather, divided watch attention, and a stopped pace on a deprivation save start that dialog at advantage or disadvantage. Those selections are passed through only when they apply, so they combine with the character's other modifiers and cancel in the normal way.
- Journey chat cards show one **Roll** button. The person who clicks it gets the dialog, including a GM rolling for someone who is offline. Journeys reads the total and the active d20 from the returned roll and keeps the existing outcome rules.
- The direct **Roll Navigation** action uses the same Survival dialog. Extreme weather starts it at disadvantage.

## Verification

`npm test` passed all 153 tests. That includes reading an advantage roll's active d20, leaving `dialog.configure` unset, presetting extreme-weather disadvantage without sending `advantage: false`, opening the roll on the clicking player's client, and creating chat requests with `modes: false`. `node --check` passed for the module entry and the roll services. Morelord Core 0.8.1 was cloned beside this repository so existing Core imports resolve. Core's design-system check was not run because this change does not add or restyle shared UI markup.

The dnd5e API was read from the system source, not guessed. `Actor5e#rollSkill(config, dialog, message)` and `rollSavingThrow(config, dialog, message)` return `Promise<D20Roll[]|null>` in 5.3.0 (the module minimum), 6.0.3 (the last Dev1 report), and 6.0.6 (the current release, 6 October 2026). This environment has no installed dnd5e system. `D20Roll.applyKeybindings` uses `config.event` with the default keys Shift (normal), Alt (advantage), and Control (disadvantage). Journeys leaves `dialog.configure` unset so those keys can skip the dialog.

No in-Foundry testing was run. There is no Foundry world in this environment, so Dev1 checks were not executed. `journeys.immediate-group-rolls` now confirms the D&D 5e dialog's Normal button before expecting the roll to finish. `journeys.grouped-roll-cards` expects one Roll button and no DIS or ADV buttons. Foundry's latest stable release is still 14.369 (8 October 2026). This change was not verified in Foundry, so `compatibility.verified` stays 14.369. Minimum 14 and maximum 14 are unchanged. No stored identifiers or campaign data were migrated or deleted. The manifest download URL still points at the published 0.5.0 zip; this change was not tagged or released.
