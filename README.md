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
- Morelord Core 0.3.6 or later
- D&D 5e adapter first, with a system-neutral journey engine

## Development

```shell
npm test
```

### Release documentation check

Production releases require the `docs` directory in the archive. Before releasing, update the manuals and set `docs/README.md` frontmatter to the target version; the shared release script rejects a missing or mismatched documentation landing page. Review all manuals as part of each code change, including behavior and compatibility requirements.
