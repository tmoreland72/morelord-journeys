# Morelord Journeys

Morelord Journeys is a Foundry Virtual Tabletop v14 module for running exploration as a structured, stateful workflow.

It manages route planning, travel-day decisions, progress, supplies, discoveries, and expedition history while leaving consequential choices with the players.

## Features

- Nine-phase travel-day workflow with weather, pace, encounters, discovery, navigation, forced march, foraging, camp, and sleep resolution
- Exact one-third-day route progress with pace, delay, navigation, discovery, and forced-march adjustments
- D&D 5e expedition roles and player-side Survival, Perception, encounter, and foraging roll requests
- Expedition-pooled food and `Water (Pint)`, plus traveler-owned tents, bedrolls, and blankets
- Persistent camp watch order, private watch rolls, 2024 rest timing, and explicit consequences
- Optional Morelord Encounters and Morelord Craftworks integrations
- Expedition log with phase names and recorded results

## Installation

Install using the manifest URL:

```text
https://raw.githubusercontent.com/tmoreland72/morelord-journeys/main/module.json
```

## Platform

- Foundry Virtual Tabletop v14 only
- Morelord Core 0.3.14 or later
- D&D 5e adapter first, with a system-neutral journey engine

## Development

```shell
npm test
```

### Release documentation check

Production releases require the `docs` directory in the archive. Before releasing, update the manuals and set `docs/README.md` frontmatter to the target version; the shared release script rejects a missing or mismatched documentation landing page. Review all manuals as part of each code change, including behavior and compatibility requirements.

Journey creation uses origin and destination as its identity, with no separate journey or route name to enter. All creation sections are collapsible and remember their state. Journey Distance is followed by Route Ratings, compact Expedition Party cards, Expedition Roles, and a Supply Manifest grouped by character and shared inventory.


Daytime encounters use the configured die (default d6) once per traveler per Danger check/day. Players trigger their requests; only GMs see dice and outcomes. Ones add encounters and maximum rolls cancel them across the party, with a minimum of zero. Route Traffic is removed. Daily Route Ratings can be changed before each travel day, carry forward, and are recorded in that day’s log. Active journey pages and Journey Settings use Core’s described, remembered collapsible sections. Traveler selection uses Core’s player-owned-or-party character eligibility.


Danger selects the encounter die: 0 → d20, 1 → d12, 2 → d10, 3 → d8, 4 → d6, 5 → d4. Each traveler rolls once during the day, including at Danger 0. Each 1 triggers an encounter. Maximums cancel encounters across the pool, except on d4 and d6. The count cannot be negative. Stopped travel skips daytime checks. There is no configurable encounter die.

Use the same Danger die at night. By default, roll four dice, one for each two-hour watch. **Journeys Settings → Encounter Dice → Night encounter frequency** can instead select eight hourly checks. Roll the whole night as a pool before playing it out: a 1 triggers an encounter, or a 1 or 2 with a visible campfire. Maximums cancel the latest triggered periods first, except on d4 and d6. Surviving encounters retain their hour range and watch. Each affected watch gets one Perception check; Send Perception / GM Roll supports offline or disconnected owners. The GM chooses combat or non-combat and records each encounter’s actual rest interruptions. Weather, tents, and stopped travel do not modify these dice. The old d100 Peaceful Rest result is no longer generated; saved historical outcomes and existing rest benefits remain supported.

**Go Back** restores the previous recorded step and Journey-applied character/supply changes. It retains 24 checkpoints, preserves unrelated edits, and requires pending requests to be resolved first. See the GM manual for undo limits. During Foraging & Supplies, Continue applies supplies and advances; pending shortage saves still require resolution.

Journey Settings uses Core’s separate, opaque page footer so Save Changes stays visible while settings scroll.


Settings use Morelord Core’s shared headers, sections, content cards, settings rows, and footer. Descriptions remain beside checkboxes at narrow widths.

The journey subtitle contains progress; daily ratings precede supplies, weather is side by side, and pace choices show hourly/daily mileage. Encounter callouts explain combat/non-combat resolution and safely closing/reopening the window. Peaceful Rest applies Heroic Inspiration directly; other benefit choices remain manual. Lost-navigation day credit includes both positive and negative travel modifiers and never grants credit for a delay canceled by Press On. See the updated GM manuals for details.

## Journey dashboard and rest

The header shows the current or upcoming travel day, beginning at Day 1. Above Ready for the Road, Journey Progress displays Days Traveled, Days Remaining, Original Duration, and Current Duration in four Core cards. Current Duration is traveled plus remaining time.

Before starting a new day, the GM can expand **Adjust Remaining Travel**, enter whole days and thirds, and select **Apply Adjustment**. This changes remaining time and current duration, preserves original duration and earned progress, and records the old and new values in the Expedition Log. Zero remaining time marks arrival. Adjustments are unavailable while a travel day is underway.

Long Rest results now use 2024 timing and clear explanatory bullets. See [the GM manual](docs/gm-manual.md#sleep--shelter) for interruptions, Trance, extra rest, and the separate optional deprivation rules.

## Optional usage and error reports

When a compatible Morelord Core is active, its explicit reporting choices can share fixed feature events and sanitized error code locations without connecting a Morelord account. Reporting is disabled in Developer Mode. No campaign content or account credentials are sent; a random world ID measures repeat use. See [Core reporting documentation](../morelord-core/TELEMETRY.md) for this module's event coverage and limitations. Existing Core versions continue to work without this optional reporting API. Website ingestion must be deployed before releasing these changes.

## Release dependency

This release requires Morelord Core 0.3.14 or newer for the shared UI and service updates. Optional integrations remain optional.


Foraging pending rows show status only; resolve checks on the grouped chat card rather than Resend/Fail/Succeed controls. A clicked chat row immediately shows centered **Completed** text without buttons, and other characters can roll while earlier dice animate. Rejected submissions restore their controls. Outcomes still wait for dice animations; pending evaluated dice are saved and recovered after reload without rerolling. Night encounters are direct GM rolls from Roll Night Encounter; only the resulting watch checks use player requests.

Journey Progress separates elapsed time from route distance: Days Completed counts finished travel days, Estimated Days Remaining assumes normal pace, and Estimated Total Duration adds those two figures. Route covered is shown separately in normal-pace travel-day equivalents. Before Day 7, six days are complete; with 1⅔ days of travel remaining, the total estimate is 7⅔ days. The original route estimate remains unchanged.

This release requires Morelord Core 0.3.14 or newer for shared roll requests, outcome scheduling, and consistent UI.
