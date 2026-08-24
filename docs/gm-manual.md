---
title: Game Master Manual
description: Install, configure, and run complete expeditions with Morelord Journeys.
slug: morelord-journeys/gm-manual
product: morelord-journeys
audience: game-master
version: 0.1.0
foundry: 14
order: 10
---

# Morelord Journeys: Game Master Manual

## Requirements

- Foundry Virtual Tabletop v14
- D&D 5e system 5.3 or later
- Morelord Core 0.1.0 or later
- GM permission in the world

Morelord Encounters is recommended for encounter construction. Morelord Craftworks is optional and adds Gather and Craft handoffs.

## Installation

Install the module using this manifest URL:

`https://raw.githubusercontent.com/tmoreland72/morelord-journeys/main/module.json`

Enable **Morelord Core** and **Morelord Journeys** in the world. Reload the world after installing or updating so Foundry loads the current module JavaScript and socket services.

## Opening Journeys

Open the Token scene controls and select the hiking-person button. Opening Journeys refreshes the Supply Manifest from the current party and traveler inventories. The refresh button remains available when inventory changes while the window is already open.

## Planning a journey

Enter the journey and route names, origin, destination, planned length, danger, and route DCs.

### Route ratings

- **Length** is the initial number of travel days.
- **Danger** determines how many encounter dice are rolled.
- **Discovery DC** is used by the Observer's Perception check.
- **Resources DC** is used by traveler foraging checks.
- **Navigation DC** is used by the Navigator's Survival check.

Select every traveler participating in the expedition. Assign an Observer and Navigator from the selected travelers. Role changes are remembered automatically and each role is only displayed during the phase where it is needed.

## Supply Manifest

The manifest reads the party Group inventory and each selected traveler's inventory.

Recognized supplies are:

- Rations and food items
- `Water (Pint)`, including `Water (1 Pint)` and items with the D&D identifier `water-pint`
- Tents
- Bedrolls
- Blankets

Waterskins, flasks, and barrels are containers, not water. Put `Water (Pint)` items inside a container and set their quantity to the number of available pints. Consuming water reduces that item quantity directly.

Supply allocation uses a traveler's own inventory first and then the shared Group inventory. It never takes supplies from another traveler.

## Starting and completing a day

Select **Begin Travel Day** to start the eight-phase cycle. Completing the cycle advances one whole travel day. Delays extend the estimated total rather than creating fractional progress.

The Expedition Log records phase names and results. The step indicator uses an orange checked circle for every completed phase.

## Weather

Weather generation is optional.

- Select **Generate Weather** to roll a result.
- Select **Reroll Weather** until the result suits the route or fiction.
- Continue without rolling to supply weather manually.
- The **Extreme Weather** control marks travel conditions that extend the journey estimate.

Cold weather is carried into Camp automatically but can be changed there when local conditions differ.

## Pace

Choose Slow, Normal, Fast, or Stopped. Pace is recorded in the Expedition Log. A completed travel cycle still advances a whole elapsed day; travel complications alter the estimated total instead of displaying fractions.

## Encounters

Roll the route's encounter dice or request player encounter rolls, depending on module settings. Each result of 1 produces a complication; the highest face produces a boon.

When a complication occurs, **Open Morelord Encounters** appears as an orange action button. If Morelord Encounters is not installed, Journeys explains how to enable it.

## Discovery

The assigned Observer receives a Perception request. The dialog opens automatically on the active owning player's client and returns the result to the GM interface.

The GM can resolve a pending request automatically when no player is available. Pursuing a discovery can extend the estimated journey length.

## Foraging

Each traveler makes a Survival check against the route's Resources DC. Player dialogs open on the appropriate clients and report results to the GM.

After all checks resolve:

1. Review the food and water required.
2. Confirm the proposed personal and Group allocations.
3. Consume supplies.
4. Resolve shortage consequences and pending Constitution saves.

**Open Morelord Craftworks - Gather** is an optional orange action. Gathering crafting materials does not replace Journeys' food and water resolution.

## Navigation

The assigned Navigator receives a Survival request against the Navigation DC. Results are recorded as success, lost, or reversed. Navigation outcomes remain part of the expedition record without turning completed days into fractions.

## Press On

Use this phase to record whether the party travels for two additional hours. Pressing on and its consequences are retained in the Expedition Log.

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

Select **Roll Watch** after assigning the traveler. Journeys:

1. Rolls the encounter check privately.
2. Opens a Perception-roll dialog on the assigned player's client.
3. Returns the Perception total to the GM's watch row.
4. Displays an orange Encounters button if a complication occurs.

A watch can produce complications or boons. The player's Perception check determines whether the character notices surprise danger or finds the boon in time.

### Sleep & Shelter

Sleep & Shelter is separate from watch planning. Tents, bedrolls, and blankets default from each traveler's own inventory. Prior selections carry into the next day.

- A tent supports two travelers and reduces the sleep DC by 5.
- A bedroll supports one traveler and reduces the sleep DC by 2.
- A blanket supports one traveler and reduces the DC by 1 in cold weather.
- Extreme weather increases the sleep DC by 5.

Select **Roll Party Sleep Checks** to save the current choices and roll privately. Each result explains whether Exhaustion decreased, increased, or could not recover because of food or water shortages.

## Journey progress

Progress is always shown in whole completed days. If delays are added, the current estimate changes while the original plan remains visible.

Example:

`2 of 6 travel days (originally planned for 4 days) — 33%`

The journey completes when the number of completed days reaches the current estimate.

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
