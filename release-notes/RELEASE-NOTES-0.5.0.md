# Morelord Journeys 0.5.0

Journeys opens from the Morelord Tools scene control.

## What Changed

### Features

- The GM opens Journeys from **Morelord Tools** on the left scene-controls bar. The **Morelord Journeys** button keeps the hiking-person icon, stays GM-only, and still warns "Morelord Journeys is still initializing." when the module is not ready.
- Morelord Core 0.6.0 or later is required. If Core does not provide the tools registry, the same button remains on the Token controls.

## Verification

`npm test` passed all 149 tests. That includes registration into Core's tools API (`id` `morelord-journeys`, order 10, GM-only, hiking-person icon, and the same initialization warning) and the Token-palette fallback when Core is older than 0.6.0 or has no `tools.register`. Morelord Core 0.5.5 was cloned beside this repository so existing Core imports resolve. That checkout does not include `api.tools`; the new tests supply a registry stand-in. Core's design-system check was not run because this change does not add or restyle shared UI markup.

No in-Foundry testing was run. There is no Foundry world in this environment, so Dev1 checks were not executed. `journeys.player-gm-access` and `journeys.gm-dashboard-access` now look for `morelordJourneys` on the Morelord Tools control and, for the fallback, on the Token palette. Foundry's latest stable release is 14.369 (8 October 2026). This module was not verified on 14.369, so `compatibility.verified` remains 14.368. Minimum 14 and maximum 14 are unchanged. No stored identifiers or campaign data were migrated or deleted.
