---
title: Game Master Manual
description: Install, configure, and run complete expeditions with Morelord Journeys.
slug: morelord-journeys/gm-manual
product: morelord-journeys
audience: game-master
version: 0.3.6
foundry: 14
order: 10
---

# Morelord Journeys: Game Master Manual

## Requirements

- Foundry Virtual Tabletop v14
- D&D 5e system 5.3 or later
- Morelord Core 0.3.14 or later
- GM permission in the world

Morelord Encounters is recommended for encounter construction. Morelord Craftworks is optional and adds Gather and Craft handoffs.

## Installation

Install the module using this manifest URL:

`https://raw.githubusercontent.com/tmoreland72/morelord-journeys/main/module.json`

Enable **Morelord Core** and **Morelord Journeys** in the world. Reload the world after installing or updating so Foundry loads the current module JavaScript and socket services.

## Opening Journeys

Open the Token scene controls and select the hiking-person button. Opening Journeys refreshes the Supply Manifest from the current party and traveler inventories. The refresh button remains available when inventory changes while the window is already open.

## Planning a journey

**Save as Default** and **Create Journey** stay visible in the bottom footer while the planner content scrolls.

Enter the origin and destination in **Journey Distance**, then choose the planned travel time. The journey is identified as Origin → Destination; separate journey and route names are not needed. **Route Ratings** follows Journey Distance. Every creation section includes a description and can be collapsed; its last state is remembered per user and world in the current browser.

### Route ratings

- **Length** is entered as whole days plus 0, ⅓, or ⅔.
- **Danger** selects the encounter die for day and night.
- **Discovery DC** is used by the Observer's Perception check.
- **Resources DC** is used by traveler foraging checks.
- **Navigation DC** is used by the Navigator's Survival check.

Select every traveler participating in the expedition. Assign an Observer and Navigator from the selected travelers. Role changes are remembered automatically and each role is only displayed during the phase where it is needed.

## Supply Manifest

The manifest reads the party Group inventory and each selected traveler's inventory. Each character and shared Group inventory has one compact card, with item names and quantities aligned in columns. Party selection cards retain traveler checkboxes and Long Rest hours without separate oversized rows.

Recognized supplies are:

- Rations and food items
- `Water (Pint)`, including `Water (1 Pint)` and items with the D&D identifier `water-pint`
- Tents
- Bedrolls
- Blankets

Waterskins, flasks, and barrels are containers, not water. Put `Water (Pint)` items inside a container and set their quantity to the number of available pints. Consuming water reduces that item quantity directly.

The Supply Manifest summarizes one Water for every four available pints; detailed allocation still uses individual pints. Empty containers contribute zero even when they retain a capacity flag. The manifest appears before beginning a day and again during Foraging, not during unrelated phases.

Food and water form one expedition pool across traveler and Group inventories. Sleeping supplies are not pooled: a traveler may only use tents, bedrolls, and blankets from that traveler's own inventory.

## Starting and completing a day

Before each day, edit **Daily Route Ratings**, located below **Ready for the Road**, to match today’s environment. Danger and the Discovery, Resources, and Navigation DCs carry forward as the next day’s defaults. Each day records its ratings in the expedition log. All journey sections have descriptions and remember their expanded or collapsed state.

Select **Begin Travel Day** to start the nine-phase cycle. Camp and Sleep & Shelter are separate phases. Journeys calculates movement in thirds. Pace supplies base movement; weather, discoveries, forced marching, and Navigation change the exact distance remaining.

The Expedition Log records phase names and results. The step indicator uses an orange checked circle for every completed phase.

## Weather

Weather resolution is required while the Weather phase is enabled.

- Roll the extreme-weather check first; a 1 on `1d20` enables extreme weather.
- Then roll a compatible forecast. An extreme day cannot generate an ordinary clear forecast.
- The override can force an extreme forecast, but it does not replace the initial check.
- Disable the Weather phase in Journeys Settings when weather will be handled entirely outside Journeys.

Cold weather is carried into Camp automatically but can be changed there when local conditions differ.

## Pace

Choose Slow (⅔ day and foraging advantage), Normal (1 day), Fast (1⅓ days, foraging disadvantage, and -5 passive Perception), or Stopped (no movement and advantage on foraging and sleep).

## Encounters

Danger selects the encounter die: 0 → d20, 1 → d12, 2 → d10, 3 → d8, 4 → d6, 5 → d4. Each traveler rolls once during the day, including at Danger 0. Each 1 triggers an encounter. Maximums cancel encounters across the pool, except on d4 and d6. The count cannot be negative. Stopped travel skips daytime checks. There is no configurable encounter die.

Select **Request Party Day Encounter Rolls**. Each active owning player receives a roll button for their character; the GM receives requests for absent players. Results are hidden from players and private roll cards are visible only to GMs. Wait for all requests to resolve before continuing; use Resend for an outstanding request. Route Traffic is no longer used.

When a complication occurs, **Open Morelord Encounters** appears as an orange action button. If Morelord Encounters is not installed, Journeys explains how to enable it.

## Discovery

The assigned Observer receives a Perception request. The dialog opens automatically on the active owning player's client and returns the result to the GM interface.

Discovery pursuit is inferred from its duration. Enter zero when the clue is ignored; otherwise enter any number of whole days plus zero, one, or two thirds. This supports extended ruins or dungeon expeditions rather than limiting discoveries to one day.

The GM can resolve a pending request automatically when no player is available. Pursuit normally costs ⅓ day, with GM-selectable whole days and additional thirds and an optional d100 lead prompt.

## Foraging

Each traveler makes a Survival check against the route's Resources DC. Player dialogs open on the appropriate clients and report results to the GM.

After all checks resolve:

1. Review the food and water required.
2. Choose food recipients if rations are scarce, or record manual supply exceptions when needed.
3. Click **Continue**. Journeys consumes the allocated supplies and advances without a separate confirmation; if hunger saves are required, resolve them before continuing.
4. Journeys immediately applies water consequences, updates hunger, and sends starvation Constitution saves when you continue. Days 1�4 without food request a daily Constitution save (default DC 10); failure adds one Exhaustion. Day 5 and each subsequent day without food automatically add one Exhaustion without a roll. Constitution does not alter this threshold. Send Save / GM Roll resends a pending request to the player or opens it for the GM when the player is offline, including after disconnecting.

**Optional Exploration Activities** appears only after every traveler's foraging check is resolved and no requests remain pending. Successful, failed, and automatically resolved checks all count. **Launch Morelord Craftworks** opens the optional gathering integration when available. Gathering crafting materials does not replace Journeys' food and water resolution.

## Navigation

The assigned Navigator receives a Survival request against the Navigation DC. Success applies the day's movement, failure by 1–4 applies no progress, and failure by 5 or more adds the day's movement back to distance remaining.

## Press On

Pressing on adds ⅓ day. Every traveler receives a DC 12 Constitution saving throw request; failure adds one Exhaustion.

## Camp

### Watch Order & Camp Actions

Assign a traveler and camp action to each watch. Assignments save automatically and carry into the following day.

Available camp actions include:

- Take a Watch
- Craft
- Cook
- Prepare
- Slumber
- Task

Selecting Craft displays a GM reminder and an orange **Open Morelord Craftworks - Craft** button.

### Rolling night encounters

Use the same Danger die at night. By default, roll four dice, one for each two-hour watch. **Journeys Settings → Encounter Dice → Night encounter frequency** can instead select eight hourly checks. Roll the whole night as a pool before playing it out: a 1 triggers an encounter, or a 1 or 2 with a visible campfire. Maximums cancel the latest triggered periods first, except on d4 and d6. Surviving encounters retain their hour range and watch. Each affected watch gets one Perception check; Send Perception / GM Roll supports offline or disconnected owners. The GM chooses combat or non-combat and records each encounter’s actual rest interruptions. Weather, tents, and stopped travel do not modify these dice. The old d100 Peaceful Rest result is no longer generated; saved historical outcomes and existing rest benefits remain supported.

A fire remains required for Craft, Cook, and Prepare. Night encounters can be disabled independently from Sleep & Shelter using journey step choices.

### Sleep & Shelter

Journeys uses 2024 Long Rest timing without a sleep check. A normal rest needs eight hours, including at least six hours asleep and at most two hours of light activity such as standing watch. Trance uses four hours of meditation; the GM can override the character's required hours.

The GM confirms eligibility at the start (at least 1 HP and sixteen hours since the previous Long Rest ended). Camp assignments determine when each traveler sleeps, watches, or works. Enter the encounter's duration, number of rest-breaking interruptions, and time within its watch. Initiative, damage, a leveled spell, or an hour of physical exertion interrupt an unfinished rest. Each interruption adds one recovery hour; time spent interrupted does not count as rest. Add extra sleep or meditation after Watch 4 when needed. Unknown event timing defaults to the beginning of its watch.

A later event cannot cancel a completed rest. For example, an elf standing Watch 1 and meditating through Watches 2 and 3 finishes before a Watch 4 encounter. Rest Results explain sleep received, interruptions, missing rest time, and Exhaustion in bullet points. Saved results from earlier rules remain labeled historical results and are not recalculated.

Shelter equipment is recorded for camp planning and does not change rest timing. The existing supply rule still prevents Exhaustion recovery when food or water is missing. The optional Xanathar-style deprivation save remains separate: a missed rest starts at DC 10 and increases by 5 on consecutive missed rests. Enable **Do not add Exhaustion for lack of sleep** to disable that save and its Exhaustion. Offline or disconnected players' pending saves can be resolved by the GM.

Journeys applies its recorded Exhaustion change and Heroic Inspiration selections. After all Sleep & Shelter rolls resolve, select **Send Long Rest Buttons** to post Core chat actions for eligible travelers. Each player (or the GM) can apply native Long Rest recovery once, without reducing Exhaustion again. Re-sending retains completed actions. Use these buttons before the next travel day; native recovery is not reversed by Go Back. Other Peaceful Rest choices remain manual; the world clock is not advanced.

## Journey progress

Progress is shown in days and thirds. The daily calculation explains every added or removed third while the original route length remains visible. The journey completes when distance remaining reaches zero.

## Troubleshooting

### Journeys does not open

Reload the Foundry world after updating. Module JavaScript and socket listeners are loaded during world startup, so closing and reopening only the Journeys window does not load changed code.

### Supplies are stale

Reopen Journeys or select the Supply Manifest refresh button. Confirm each traveler still belongs to the expedition and the expected Group actor contains the shared inventory.

### Water shows zero

Confirm the actor owns an item named `Water (Pint)` or `Water (1 Pint)`. A waterskin alone contributes no water. Set the water item's quantity, place it inside the waterskin if desired, then reopen Journeys or refresh the manifest.

### A player request does not appear

Confirm the player is active and owns the assigned Actor. Reload both GM and player clients after updating the module so both clients register the same socket service version.

### An integration button is unavailable

Confirm the corresponding Morelord module is installed and active. Reload the world after enabling modules so their public APIs are available.

## Shared travel context and automatic checks

The GM can select a shared Core Location, set personal activity hours for the travel day, and add temporary capabilities available during the journey. Manage Locations opens Core's shared registry. Temporary capabilities do not permanently change the Location. Optional Downtime integration uses completed days and personal activity hours; Journeys remains usable when Downtime is absent.

A check with an effective DC of zero succeeds automatically without a player roll dialog. Long Rest timing does not require a sleep check. Automatic success does not waive Long Rest requirements, create extra foraging rewards, or erase ordinary food and water consequences.

Character portraits identify travelers in assignments, checks, supplies, and results. Changing a travel phase returns its page to the top; ordinary updates retain the page position.

## Native recovery and the world calendar

Journeys records Long Rest sleep eligibility and applies its documented Exhaustion changes. The optional **Send Long Rest Buttons** action invokes native Long Rest recovery when the player or GM clicks their chat button, without a second Exhaustion reduction or advancing world time. D&D 5e v6 day/dawn/dusk recovery requires advancing the system calendar separately.

### Current journey display and progress

The header shows the current or upcoming travel day, beginning at Day 1. Above Ready for the Road, Journey Progress displays Days Traveled, Days Remaining, Original Duration, and Current Duration in four Core cards. Current Duration is traveled plus remaining time.

Before starting a new day, the GM can expand **Adjust Remaining Travel**, enter whole days and thirds, and select **Apply Adjustment**. This changes remaining time and current duration, preserves original duration and earned progress, and records the old and new values in the Expedition Log. Zero remaining time marks arrival. Adjustments are unavailable while a travel day is underway.

Daily Route Ratings precede supplies. Weather checks and forecasts use two columns. Pace options express this module’s travel scale in miles: Slow 2/hour and 16/day, Normal 3/hour and 24/day, Fast 4/hour and 32/day, Stopped 0.

A triggered encounter is highlighted as combat or non-combat; the GM may close Journeys while resolving it and return afterward. Dice-count arithmetic is in Outcome Details, and phase help stays beside the section title.

Lost navigation removes base pace progress but balances delays against extra travel, with a minimum of zero travel credit. Thus a ⅓-day encounter delay plus ⅓-day Press On produces zero credit after a lost-navigation day. Previously completed historical logs are retained.


## Go Back

The GM’s **Go Back** button restores the previous recorded step to its entry state, including journey progress, rolls, delays, and Journey-applied inventory, hunger, Exhaustion, and automatic Inspiration changes. It also undoes changes already applied in the current step. Resolve pending player requests first. Repeat the step to recalculate; old chat messages remain historical and are not deleted. Manually applied effects and activities in other modules are outside this undo record.

Undo history starts when this version first opens or saves the journey; earlier actions cannot be reconstructed. It retains the latest 24 step checkpoints across reloads. If an affected value or a generated item has since changed elsewhere, Go Back stops before changing anything. Resolve the conflicting edit before retrying. If a document write fails during restoration, retry Go Back to finish; normal journey changes are blocked until restoration completes.
