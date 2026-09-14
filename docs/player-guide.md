---
title: Player Guide
description: Respond to journey checks, manage travel supplies, and resolve camp watches as a player.
slug: morelord-journeys/player-guide
product: morelord-journeys
audience: player
version: 0.3.4
foundry: 14
order: 20
---

# Morelord Journeys: Player Guide

Morelord Journeys gives players direct responsibility for the checks their characters make during travel. When the GM requests a check, a dialog opens automatically on the client of the player who owns the assigned character.

## Before departure

Keep travel supplies on your character or in the shared party Group inventory.

- Food and water carried by travelers and the Group actor are pooled for the expedition.
- Water is tracked as `Water (Pint)` quantity; a Medium traveler needs four pints when no source is found.
- Waterskins and flasks are containers and do not count as water by themselves.
- Tents, bedrolls, and blankets are used during Sleep & Shelter, but only by the traveler who personally owns them.

You may place `Water (Pint)` inside a waterskin. Journeys counts the contained water item and consumes its quantity when needed.

## Player roll requests

Keep the Foundry world open during the expedition. A request dialog identifies the character, skill, purpose, and DC when applicable.

Select the roll button and complete the normal D&D 5e configuration dialog. The result is posted through D&D 5e and returned to the GM's Journeys interface automatically.

## Discovery checks

The Observer rolls Perception to notice discoveries and opportunities along the route. The GM decides whether the party pursues a lead after seeing the result.

## Foraging checks

Every traveler may receive a Survival request during Foraging. Success reduces the supplies needed from inventory. The GM resolves allocation and shortages after all travelers respond.

## Navigation checks

The Navigator rolls Survival against the route's Navigation DC. The result is recorded in the Expedition Log so the party can see what happened during the day.

## Encounter rolls

Each participating character receives a daytime encounter request. Press its roll button to roll the die chosen in Journeys Settings once per Danger check/day. Only the GM sees the dice and encounter count. A 1 adds an encounter and a maximum result cancels one across the party. These requests do not show a public result or a dice configuration dialog.

## Camp watches

Journeys makes one night encounter roll for camp. If it selects your character's watch, a Perception request opens on your client.

Roll Perception to determine whether your character notices a surprise encounter or finds a boon. The total returns to the GM and appears beside that watch.

Your selected camp action may affect how alert the character is:

- **Take a Watch** keeps full attention on the surroundings.
- **Craft**, **Cook**, **Prepare**, and most tasks divide attention and impose disadvantage.
- **Slumber** means the character is asleep and automatically fails Perception checks.

Craft, Cook, and Prepare require a campfire. A character who is not assigned to Take a Watch receives the same rest treatment as Slumber.

Follow the GM's instruction about advantage or disadvantage in the D&D 5e roll configuration dialog.

## Crafting during camp

If Craft is selected, the GM will tell the assigned player to open Morelord Craftworks and perform a Craft action. Journeys records the camp assignment, while Craftworks resolves the crafting activity.

## Sleep and shelter

The GM reviews each traveler's tent, bedroll, and blanket before rolling sleep checks. Your own inventory supplies the default choices.

Sleep checks are private. The GM interface records the result and explains the consequence:

- Safe sleep can reduce Exhaustion when the character was fed and watered.
- Supply shortages can prevent recovery even after a successful check.
- Journeys tracks sleep hours and interruptions. Missing a Long Rest can trigger an escalating Xanathar-style Constitution save against Exhaustion unless the GM disables that consequence.

## If a request does not appear

1. Confirm you are logged in and active.
2. Confirm your user owns the assigned character.
3. Ask the GM to resend or reroll the relevant step.
4. Reload the Foundry world if the module was just installed or updated.

## Automatic checks and personal activity time

When the effective DC is zero, Journeys resolves the check without opening a player roll dialog. Equipment can reduce the Sleep check to zero, but the character must still meet the Long Rest requirements. Ordinary foraging rewards and food or water consequences continue to apply.

The GM may provide personal activity hours and Location capabilities for the travel day. If Downtime is enabled, eligible Projects can use that travel context; ask the GM which activities are available. Character portraits help distinguish assignments when you control more than one traveler.
