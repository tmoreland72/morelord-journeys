# Morelord Journeys Changelog

## 0.5.1

### Fixes

- Discovery, Navigation, foraging, and watch Perception checks call `actor.rollSkill`. Press On and sleep deprivation call `actor.rollSavingThrow`. Both use the D&D 5e configuration dialog, so effects, flags, dialog choices, and the system's modifier keys apply. The dialog stays closed only when those keys request it.
- Pace, extreme weather, divided watch attention, and a stopped pace on a deprivation save start that dialog at advantage or disadvantage. Those selections are passed through only when they apply, so they combine with the character's other modifiers and cancel in the normal way.
- Journey chat cards show one **Roll** button. The person who clicks it gets the dialog, including a GM rolling for someone who is offline. Journeys reads the total and the active d20 from the returned roll and keeps the existing outcome rules.
- The direct **Roll Navigation** action uses the same Survival dialog. Extreme weather starts it at disadvantage.

## 0.5.0

### Features

- The GM opens Journeys from **Morelord Tools** on the left scene-controls bar. The **Morelord Journeys** button keeps the hiking-person icon, stays GM-only, and still warns "Morelord Journeys is still initializing." when the module is not ready.
- Morelord Core 0.6.0 or later is required. If Core does not provide the tools registry, the same button remains on the Token controls.

## 0.4.1

### Fixes

- **Duration (hours)** on a rolled night encounter can be 0. Zero hours does not interrupt the long rest: no recovery hour is added, interrupted time is not lost, and rest results say the long rest was not interrupted. The control still defaults to 1 hour, changes in whole hours from 0 through 8, and does not allow typing. Durations of 1 hour or more are unchanged.

## 0.4.0

### Features

- Added named Saved Journeys. Use **Save Journey** to keep a planner setup and **Choose Saved Journey** to open its manager. **Select Journey** fills a fresh planner; **Save Journey** renames the selected preset; **Delete** removes it.
- Saved setups retain route, duration, ratings, enabled steps, party, individual Long Rest hours, and roles. They do not retain inventory quantities or expedition progress. Supplies come from current actor inventories when creating the new journey. Named setups remain independent of **Save as Default**.
- Saved Journeys uses Core's manager layout, responsive grid, selection states, controls, and fixed page footer. GM access is enforced for the dashboard and manager.

### Fixes

- Disabled and skipped steps no longer post completion cards or appear in the displayed step sequence/recent activity. Completion numbering follows included steps, including Stopped pace. Saving removes identified stale cards for that journey and renumbers those that remain; unidentified historical cards are retained.
- Each accepted night encounter now has one timed rest interruption per traveler. **Duration (hours)** defaults to one, changes in whole-hour steps, and stays within one to eight hours; direct typing is disabled.
- **Reject encounter** removes the selected encounter and interruption while retaining its dice. Watch Perception requests remain when another accepted encounter still needs that watch; otherwise pending requests are retired.
- Night encounter summaries appear after Outcome Details. Pending watch checks now produce their intended continuation error without masking it or reporting it twice.
- Reordered the planner to Journey Distance, Expedition Party, Route Ratings, Expedition Roles, and Supply Manifest. Updated the documentation landing page, README, GM manual, and player guide version metadata.

## 0.3.10

### Fixes

- Players no longer see the Journeys toolbar button or open the GM expedition dashboard through the public API or a direct application call.
- Journey saves and clears explicitly require GM privileges. Players retain their character chat roll controls and public progress updates.
- Updated the GM manual and player guide to explain the access boundary.

## 0.3.9

### Improvements

- Documentation opens the GM manual and player guide through Core.
- Added a manifest changelog link and moved release history into `release-notes/`. Local working files belong in ignored `/tmp/`.

- Release staging and generated ZIP files use module-local `/tmp/`; ZIP validation rejects working files and release-note sources.

## 0.3.8

### Added

- Send Long Rest Buttons after Sleep & Shelter resolves, using Core's shared chat requests for eligible travelers with GM fallback and without repeating Exhaustion recovery.

### Fixed

- Planner Save as Default and Create Journey actions remain visible in the shared footer while setup content scrolls.
- Watch Perception labels use a readable dash, including previously posted requests when rendered.
- Section subtitles and explanatory paragraphs follow Core's shared text styling.

## 0.3.7

### Improvements

- Use Core grouped party requests for encounter, discovery, navigation, foraging, Press On, and sleep-deprivation checks, with offline-player GM fallback and independent character DCs.
- Show Completed immediately and keep other roll controls usable; delay derived outcomes until dice animations finish. Persist evaluated rolls for recovery and serialize final updates against current journey state.
- Use Request Encounters Roll, Request Discovery Check, Request Navigation Check, Request Foraging Rolls, and Request Sleep Deprivation Roll labels. Remove foraging Resend, Fail, and Succeed controls.
- Restore direct private GM night-encounter rolls.
- Separate completed calendar days from route progress so the current day, remaining travel, and total estimate agree.

## 0.3.6

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

## 0.3.5

### Improvements

- Clarified that journey sleep and Exhaustion resolution do not perform native Long Rest recovery or advance world time, including guidance to avoid duplicate recovery. No rest rules changed.
- Verified Foundry compatibility is explicitly recorded as 14.367; existing Foundry and system support minimums remain unchanged.
- Release guidelines require checking the latest stable Foundry build and confirming the published Foundry listing.

## 0.3.4

### Improvements

- Days 1�4 without food request a daily Constitution save (default DC 10); failure adds one Exhaustion. Day 5 and each subsequent day without food automatically add one Exhaustion without a roll. Constitution does not alter this threshold. Send Save / GM Roll resends a pending request to the player or opens it for the GM when the player is offline, including after disconnecting. The daily DC remains configurable; the old hunger DC increase is no longer used.

- Settings use Core headers, section headings, cards, responsive settings rows, badges, and footers; duplicated local settings styling has been removed.

- Journey Settings uses Core’s separate, opaque page footer so Save Changes stays visible while settings scroll.

- Daily Route Ratings now appears below Ready for the Road on journey days.

- Daytime encounters use the configured die (default d6) once per traveler per Danger check/day. Players trigger their requests; only GMs see dice and outcomes. Ones add encounters and maximum rolls cancel them across the party, with a minimum of zero. Route Traffic is removed. Daily Route Ratings can be changed before each travel day, carry forward, and are recorded in that day’s log. Active journey pages and Journey Settings use Core’s described, remembered collapsible sections. Traveler selection uses Core’s player-owned-or-party character eligibility.

- Journey Steps now collapses and remembers its last state per user and world in the current browser. It starts expanded; collapsing preserves step selections.

- Create Journey now uses the standard button appearance and hover state instead of starting with a solid orange background.

- Removed Journey Name and Route Name inputs. New labels derive from origin and destination while existing stored names remain compatible.
- All creation sections are collapsible and described; Journey Distance is followed by Route Ratings.
- Party cards use compact Core selection controls. Supply cards group items by character or shared inventory with aligned name and quantity columns.

- Hide Optional Exploration Activities until every party foraging check is resolved and no requests remain pending.

### Changed

- Require Morelord Core 0.3.7 or later for the shared components and character eligibility used by this release.

## 0.3.3

### Improvements

- Use Core scroll preservation and retain top-of-page resets between travel phases.
- Require packaged product documentation and validate its landing-page version.

### Fixed

- Update manuals, Core requirements, travel-context guidance, zero-DC behavior, and the nine-phase workflow description.
- Synchronize the release script with Core.

### Changed

- Require Morelord Core 0.3.6 or later for the shared UI services used by this release.

## 0.3.2

### Improvements

- Align planning and travel steps with shared Morelord section cards, headings, controls, and spacing.
- Show circular character portraits alongside names throughout party assignments, checks, supplies, and outcomes.
- Improve Supply Manifest readability with body-size names and spacious item rows.
- Retain planner and journey-step defaults and improve camp watch assignment controls.

### Fixed

- Resolve zero-DC checks automatically without asking players to roll, including sleep checks after equipment modifiers.
- Preserve Long Rest requirements, ordinary foraging rewards, and supply consequences when checks succeed automatically.
- Correct camp watch sleep-hour accounting and preserve assignments when camp controls change.

## 0.3.1

### Changed

- Require Morelord Core 0.3.0 so Journeys always uses the current global components, CSS, and public APIs.
- Confirm Journeys does not need Core's source-book label resolver because it does not display compendium asset attribution.

## 0.3.0

### Added

- Added a GM-managed travel context with a shared Location and configurable personal activity hours for each travel day.
- Added temporary travel capabilities for services available only while the current Journey context is active.
- Added a public Journeys travel-context API for optional module integrations.
- Added a duplicate-safe `morelordJourneys.dayComplete` hook containing the completed day, travel progress, Location, activity hours, and temporary capabilities.
- Added documentation and automated coverage for the travel and Downtime integration contract.

### Improvements

- Preserved travel context on newly started days and in completed-day payloads.
- Added direct access to Morelord Core Location management from the Journey interface.
- Added environment-file guidance for the standard Morelord release workflow.

## 0.2.1

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

## 0.2.0

### Added

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

### Changed

- Journey windows now open larger, retain scroll position across rerenders, and use responsive character-oriented layouts.
- Encounter results emphasize narrative outcomes while retaining calculations in expandable audit details.
- Food and water remain pooled, but allocation uses the consumer's inventory first, then the Group actor, then another traveler.
- Sleeping equipment remains personal and cannot be borrowed from another traveler or the Group actor.
- Water is tracked in pints and displayed as four-pint daily servings without double-counting containers and contained water.
- Hunger allows `3 + Constitution modifier` days without food, then requests escalating Constitution saves; a full daily ration resets hunger.
- Missing a full day's water automatically adds one Exhaustion.
- Sleep deprivation uses escalating Xanathar-style saves by default and can be disabled without granting Long Rest benefits.
- Cook can remove one Exhaustion from up to two selected characters; obsolete additional-Hit-Die benefits were removed.

### Fixed

- Player-returned Press On and Peaceful Rest results now refresh and clear correctly on the GM screen.
- Initial fractional route lengths and days remaining retain their thirds.
- Supply allocation no longer consumes another character's ration before the consumer's own ration.
- Waterskins no longer double-count water already represented by contained pint items.
- Sleep hours reset from eight minus two hours per watch instead of inheriting stale daily values.
- Failed discoveries enforce no time loss, while successful navigation enforces route progress.
- Help controls, checkbox labels, discovery controls, camp actions, foraging rows, and sleep results no longer overflow or wrap unpredictably.

## 0.1.0

### Added

- Added an eight-phase travel-day workflow covering weather, pace, encounters, discovery, foraging, navigation, pressing on, and camp.
- Added optional weather generation with rerolls, cold-weather detection, and journey-extending extreme-weather delays.
- Added whole-day journey progress with revised estimates such as “2 of 6 travel days (originally planned for 4 days).”
- Added socket-driven player roll requests for expedition roles, encounters, foraging, shortage saves, and camp-watch Perception checks.
- Added inventory-backed supply tracking for rations, `Water (Pint)`, tents, bedrolls, and blankets across party and traveler inventories.
- Added persistent camp watch order, automatic sleep and shelter defaults, private watch and sleep rolls, and explicit sleep consequences.
- Added Morelord Encounters and Morelord Craftworks integration buttons where those actions are relevant.
- Added an Expedition Log containing phase names and recorded results.

### Improvements

- Expedition roles now appear only during the phases where they are needed and save automatically.
- Supply manifests refresh whenever Journeys is opened and can still be refreshed manually.
- Completed phase indicators use solid orange circles with checkmarks.
- Journey configuration, expedition layout, action emphasis, and supply-source presentation were streamlined.

### Fixed

- Fixed completed travel days being displayed as confusing fractional days.
- Fixed camp-watch buttons becoming disabled when another watch assignment changed.
- Fixed contained `Water (Pint)` inventory quantities not being recognized or consumed correctly.
- Fixed a silent expedition-log render failure that prevented the Journeys window from opening.
