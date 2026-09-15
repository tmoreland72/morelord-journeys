# Morelord Journeys

Morelord Journeys is a Foundry Virtual Tabletop v14 module for running exploration as a structured, stateful workflow.

It manages route planning, travel-day decisions, progress, supplies, discoveries, and expedition history while leaving consequential choices with the players.

## Features

- Nine-phase travel-day workflow with weather, pace, encounters, discovery, navigation, forced march, foraging, camp, and sleep resolution
- Exact one-third-day route progress with pace, delay, navigation, discovery, and forced-march adjustments
- D&D 5e expedition roles and player-side Survival, Perception, encounter, and foraging roll requests
- Expedition-pooled food and `Water (Pint)`, plus traveler-owned tents, bedrolls, and blankets
- Persistent camp watch order, private watch rolls, sleep checks, and explicit consequences
- Optional Morelord Encounters and Morelord Craftworks integrations
- Expedition log with phase names and recorded results

## Installation

Install using the manifest URL:

```text
https://raw.githubusercontent.com/tmoreland72/morelord-journeys/main/module.json
```

## Platform

- Foundry Virtual Tabletop v14 only
- Morelord Core 0.3.7 or later
- D&D 5e adapter first, with a system-neutral journey engine

## Development

```shell
npm test
```

### Release documentation check

Production releases require the `docs` directory in the archive. Before releasing, update the manuals and set `docs/README.md` frontmatter to the target version; the shared release script rejects a missing or mismatched documentation landing page. Review all manuals as part of each code change, including behavior and compatibility requirements.

Journey creation uses origin and destination as its identity, with no separate journey or route name to enter. All creation sections are collapsible and remember their state. Journey Distance is followed by Route Ratings, compact Expedition Party cards, Expedition Roles, and a Supply Manifest grouped by character and shared inventory.


Daytime encounters use the configured die (default d6) once per traveler per Danger check/day. Players trigger their requests; only GMs see dice and outcomes. Ones add encounters and maximum rolls cancel them across the party, with a minimum of zero. Route Traffic is removed. Daily Route Ratings can be changed before each travel day, carry forward, and are recorded in that day’s log. Active journey pages and Journey Settings use Core’s described, remembered collapsible sections. Traveler selection uses Core’s player-owned-or-party character eligibility.


Journey Settings uses Core’s separate, opaque page footer so Save Changes stays visible while settings scroll.


Settings use Morelord Core’s shared headers, sections, content cards, settings rows, and footer. Descriptions remain beside checkboxes at narrow widths.

The journey subtitle contains progress; daily ratings precede supplies, weather is side by side, and pace choices show hourly/daily mileage. Encounter callouts explain combat/non-combat resolution and safely closing/reopening the window. Peaceful Rest applies Heroic Inspiration directly; other benefit choices remain manual. Lost-navigation day credit includes both positive and negative travel modifiers and never grants credit for a delay canceled by Press On. See the updated GM manuals for details.
