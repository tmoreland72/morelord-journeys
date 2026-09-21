# Morelord Journeys 0.3.6

Updates to shared reporting and journeys workflows.

## What Changed

### Improvements

- Added optional feature/error instrumentation through Core's shared reporting service. Fresh GM consent is required; account connection is not. Existing Core dependencies and game behavior are unchanged.
- Replaced configurable encounter dice and night d100 modifiers with Danger-based d20/d12/d10/d8/d6/d4. Day checks roll once per traveler; nights roll per watch with optional hourly checks. Fire triggers on 1–2; maximum cancellation is disabled on d4/d6. Historical results and pending legacy day requests remain intact.
- Each surviving night encounter shows its period, watch, and rest interruption controls. Watch Perception requests support GM fallback after disconnect.
- Added GM Go Back with persistent step checkpoints and reversal of Journey-applied supplies, hunger, Exhaustion, and Inspiration. Conflicting external edits block undo; interrupted restoration can be resumed.
- Removed the separate Confirm & Consume Supplies button. Continue applies supplies and advances, pausing for required shortage saves. Scarce-food choices and manual exceptions remain available.
- Night encounters prominently show the affected watch and hours since camp began, including unwatched periods. The Camp notice appears before the Perception request; prompts and GM encounter roll messages include the same timing.
- A Core dashboard above Ready for the Road shows Days Traveled, Days Remaining, Original Duration, and Current Duration. The header retains the day label.
- GMs can adjust remaining days and thirds before starting a day; original duration and earned progress remain unchanged, and the adjustment is logged. Zero marks arrival.
- Rest uses 2024 timing, including four-hour Trance, timed interruptions, and extra recovery. No sleep check is required. Later encounters cannot cancel completed rests. Clear result bullets explain sleep, interruptions, eligibility, and Exhaustion; historical results remain unchanged.
- Moved the weather season selector above both weather columns and removed the redundant roll-order sentence.
- Supply Manifest item lists consistently show food, water, then shelter gear (tents, bedrolls, blankets), including existing saved manifests.
- The journey header starts at Day 1, shows the current day during travel, and advances to the upcoming day when ready to travel again. Arrival retains the final travel day's number.
- Journey progress appears in dashboard cards above Ready for the Road, and Daily Route Ratings precede supplies. Weather uses two columns and pace choices show miles/hour and miles/day.
- Encounter results use a visible callout, explain combat/non-combat choices and closing/reopening, and keep dice arithmetic in Outcome Details. Phase help remains beside the section title.
- Peaceful Rest has a wider dialog with content-sized buttons; choosing Heroic Inspiration updates the character sheet.
- Lost navigation now balances delays against extra travel: a ⅓-day encounter delay and ⅓-day Press On produce zero credit after losing base travel progress.

## Compatibility and verification

Verified release workflows on Foundry VTT 14.368 with D&D5e 6.0.3 in a disposable test world. Supported minimum/maximum bounds are unchanged. Existing Node tests and the shared Core design-system check passed; in-game evidence is retained in the repositories.
