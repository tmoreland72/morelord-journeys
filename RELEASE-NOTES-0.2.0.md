# Morelord Journeys 0.2.0

Morelord Journeys 0.2.0 expands the travel workflow with the Travel Guide mechanics, stronger player/GM coordination, detailed camp and supply resolution, and a more auditable interface.

## Added

- Exact one-third-day route lengths, progress, delays, discoveries, and forced-march advances.
- Travel Guide pace, navigation, discovery, day encounter, night encounter, foraging, and sleep outcomes.
- GM-configurable workflow steps and granular contextual help throughout the interface.
- Player requests with resend and GM override controls for expedition checks, forced marches, foraging, camp Perception, starvation, and Peaceful Rest choices.
- One nightly encounter roll with automatic route, weather, danger, campfire, and camp-quality modifiers plus random affected-watch selection.
- Morelord Encounters handoffs for consequential day and night encounters, including active or passive detection context.
- Campfire requirements for Craft, Cook, and Prepare, with camp setup quality and encounter tradeoffs.
- Separate Sleep & Shelter resolution with owned-equipment selection, automatic weather state, sleep-hour tracking, combat interruptions, and Long Rest outcomes.
- Peaceful Rest player choices and GM recovery controls.
- Collapsible Outcome Details cards for GM-facing rolls and calculations.
- Detailed implementation plan, GM rules reference, and expanded GM/player documentation.

## Changed

- Journey windows now open larger, retain scroll position across rerenders, and use responsive character-oriented layouts.
- Encounter results emphasize narrative outcomes while retaining calculations in expandable audit details.
- Food and water remain pooled, but allocation uses the consumer's inventory first, then the Group actor, then another traveler.
- Sleeping equipment remains personal and cannot be borrowed from another traveler or the Group actor.
- Water is tracked in pints and displayed as four-pint daily servings without double-counting containers and contained water.
- Hunger allows `3 + Constitution modifier` days without food, then requests escalating Constitution saves; a full daily ration resets hunger.
- Missing a full day's water automatically adds one Exhaustion.
- Sleep deprivation uses escalating Xanathar-style saves by default and can be disabled without granting Long Rest benefits.
- Cook can remove one Exhaustion from up to two selected characters; obsolete additional-Hit-Die benefits were removed.

## Fixed

- Player-returned Press On and Peaceful Rest results now refresh and clear correctly on the GM screen.
- Initial fractional route lengths and days remaining retain their thirds.
- Supply allocation no longer consumes another character's ration before the consumer's own ration.
- Waterskins no longer double-count water already represented by contained pint items.
- Sleep hours reset from eight minus two hours per watch instead of inheriting stale daily values.
- Failed discoveries enforce no time loss, while successful navigation enforces route progress.
- Help controls, checkbox labels, discovery controls, camp actions, foraging rows, and sleep results no longer overflow or wrap unpredictably.

## Compatibility

- Foundry Virtual Tabletop v14.
- D&D 5e 5.3 or later.
- Morelord Core 0.1.0 or later.
- Morelord Encounters is recommended; Morelord Craftworks integration remains optional.
