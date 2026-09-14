---
title: Game Master Manual
description: Install, configure, and run complete expeditions with Morelord Journeys.
slug: morelord-journeys/gm-manual
product: morelord-journeys
audience: game-master
version: 0.3.4
foundry: 14
order: 10
---

# Morelord Journeys: Game Master Manual

## Requirements

- Foundry Virtual Tabletop v14
- D&D 5e system 5.3 or later
- Morelord Core 0.3.7 or later
- GM permission in the world

Morelord Encounters is recommended for encounter construction. Morelord Craftworks is optional and adds Gather and Craft handoffs.

## Installation

Install the module using this manifest URL:

`https://raw.githubusercontent.com/tmoreland72/morelord-journeys/main/module.json`

Enable **Morelord Core** and **Morelord Journeys** in the world. Reload the world after installing or updating so Foundry loads the current module JavaScript and socket services.

## Opening Journeys

Open the Token scene controls and select the hiking-person button. Opening Journeys refreshes the Supply Manifest from the current party and traveler inventories. The refresh button remains available when inventory changes while the window is already open.

## Planning a journey

Enter the origin and destination in **Journey Distance**, then choose the planned travel time. The journey is identified as Origin → Destination; separate journey and route names are not needed. **Route Ratings** follows Journey Distance. Every creation section includes a description and can be collapsed; its last state is remembered per user and world in the current browser.

### Route ratings

- **Length** is entered as whole days plus 0, ⅓, or ⅔.
- **Danger** sets daytime encounter checks per traveler per day.
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

Choose the daytime encounter die in Journeys Settings (d6 by default). Each traveler rolls that die once for every check/day shown by Danger. At Extreme (Danger 4), four travelers make 16 rolls. Each 1 adds one encounter, and each maximum die result cancels one encounter across the entire party; the total cannot be negative. Danger 0 requires no rolls.

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
2. Confirm the proposed personal and Group allocations.
3. Consume supplies.
4. Journeys immediately applies water consequences, updates hunger, and sends starvation Constitution saves after supplies are confirmed. Days 1�4 without food request a daily Constitution save (default DC 10); failure adds one Exhaustion. Day 5 and each subsequent day without food automatically add one Exhaustion without a roll. Constitution does not alter this threshold. Send Save / GM Roll resends a pending request to the player or opens it for the GM when the player is offline, including after disconnecting.

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

### Rolling a watch

Camp makes one night d100 roll. Danger, weather, and derived camp quality modify the result. A fire is required for Craft, Cook, and Prepare; it indicates excellent setup but also advertises the camp. No fire and no tents indicates poor setup. Assignments save automatically. Anyone not assigned to Take a Watch receives Slumber's rest treatment.

Journeys Settings can disable the nightly d100 independently from Sleep & Shelter. Camp must resolve its enabled nightly check before advancing. Sleep checks and pending Peaceful Rest choices are completed on the following Sleep & Shelter phase.

### Sleep & Shelter

Sleep & Shelter is separate from watch planning. Tents, bedrolls, and blankets default from each traveler's own inventory. Prior selections carry into the next day.

- A traveler-owned tent reduces that traveler's sleep DC by 5.
- A bedroll supports one traveler and reduces the sleep DC by 2.
- A blanket supports one traveler and reduces the DC by 1 in cold weather.
- Extreme weather increases the sleep DC by 5.
- A Peaceful Rest night result reduces the sleep DC by 5.

Select **Roll Party Sleep Checks** to roll privately. Cold weather is inherited from the forecast. Sleep begins at eight hours minus two hours for each watch taken. Journeys tracks interruptions in hours; a Night Attack prefills one combat-interruption hour for the affected watcher, while Minor encounters add no interruption unless the GM determines that combat occurred. Six hours of sleep and less than one interrupted hour are required. Player-submitted Peaceful Rest selections are shown to the GM and committed when the phase advances; Journeys does not apply those benefits mechanically. Missed Long Rests use escalating Xanathar-style deprivation saves unless the GM enables **Do not add Exhaustion level for lack of sleep**.

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

A check with an effective DC of zero succeeds automatically without a player roll dialog. Sleep applies equipment modifiers before deciding whether a roll is needed. Automatic success does not waive Long Rest requirements, create extra foraging rewards, or erase ordinary food and water consequences.

Character portraits identify travelers in assignments, checks, supplies, and results. Changing a travel phase returns its page to the top; ordinary updates retain the page position.

## Native recovery and the world calendar

Journeys records Long Rest sleep eligibility and applies its documented Exhaustion changes. It does not invoke native character-sheet Long Rest recovery or advance the world clock. Resolve HP, spell-slot, and item-use recovery separately through the system, checking that Exhaustion is not reduced a second time. D&D 5e v6 day/dawn/dusk recovery requires advancing the system calendar separately.
