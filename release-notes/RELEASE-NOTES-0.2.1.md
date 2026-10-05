# Morelord Journeys 0.2.1

Morelord Journeys 0.2.1 consolidates shared interface behavior into Morelord Core and removes redundant feature styling.

## What Changed

### Improvements

- Migrated cards, surfaces, grids, action groups, empty states, statuses, contextual help controls, accent buttons, and outcome audit details to Core components.
- Reduced Journey-owned CSS to expedition, phase, party, supply, foraging, camp, and sleep-specific layouts.
- Updated the minimum Morelord Core version to 0.2.1 for the expanded design-system contract.

### Fixed

- Removed obsolete and duplicate Journey CSS definitions that could override shared component behavior.
- Routed Discovery, Navigation, encounter, foraging, forced-march, camp Perception, starvation, and Peaceful Rest requests to active player owners before falling back to the GM.
- Routed sleep and follow-up sleep-deprivation Constitution saves to active player owners, with GM resend and manual-resolution controls.
- Moved every client request lifecycle onto Morelord Core's targeted contextual socket infrastructure, including Discovery, Navigation, encounters, foraging, Forced March, camp Perception, sleep and sleep deprivation, starvation saves, and Peaceful Rest choices.
- Serialized all GM-bound Journey results through a shared state queue so simultaneous replies cannot overwrite completed checks or restore them to pending.
- Allowed Journeys to register its Core request channels before Socketlib finishes connecting, preventing the Journeys launcher from remaining stuck in its initializing state.
- Distinguished sleep-check success from Long Rest completion in summary statuses and Outcome Details, including explicit explanations of unmet Long Rest requirements.
- Refilled all known traveler- and group-owned water containers immediately when completed party foraging checks include at least one success: waterskins 4 pints, flasks 1, jugs 8, and barrels 320.
- Included every player-owned character in the new Journey expedition list while retaining members of the primary Foundry party group as the default selections.
- Added GM-adjustable Long Rest hour requirements during expedition setup, initially guessed from a Journeys actor override, the Trance feature, or the standard six-hour sleep requirement; saved requirements now drive Long Rest resolution and Outcome Details.
- Restored the character name as the primary expedition-card content and moved the Long Rest requirement into a smaller secondary row aligned beneath the name.
