---
title: Player Guide
description: Respond to journey checks, manage travel supplies, and resolve camp watches as a player.
slug: morelord-journeys/player-guide
product: morelord-journeys
audience: player
version: 0.1.0
foundry: 14
order: 20
---

# Morelord Journeys: Player Guide

Morelord Journeys gives players direct responsibility for the checks their characters make during travel. When the GM requests a check, a dialog opens automatically on the client of the player who owns the assigned character.

## Before departure

Keep travel supplies on your character or in the shared party Group inventory.

- Food is recognized from rations and food items.
- Water is tracked as `Water (Pint)` quantity.
- Waterskins and flasks are containers and do not count as water by themselves.
- Tents, bedrolls, and blankets are used during Sleep & Shelter.

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

When player encounter rolling is enabled, Journeys opens an encounter-die request. A result of 1 is a complication; the die's highest result is a boon.

## Camp watches

When your character is assigned a watch, the GM's **Roll Watch** action opens a Perception request on your client.

Roll Perception to determine whether your character notices a surprise encounter or finds a boon. The total returns to the GM and appears beside that watch.

Your selected camp action may affect how alert the character is:

- **Take a Watch** keeps full attention on the surroundings.
- **Craft**, **Cook**, and many tasks divide attention and may justify disadvantage.
- **Slumber** means the character is asleep and automatically fails Perception checks.

Follow the GM's instruction about advantage or disadvantage in the D&D 5e roll configuration dialog.

## Crafting during camp

If Craft is selected, the GM will tell the assigned player to open Morelord Craftworks and perform a Craft action. Journeys records the camp assignment, while Craftworks resolves the crafting activity.

## Sleep and shelter

The GM reviews each traveler's tent, bedroll, and blanket before rolling sleep checks. Your own inventory supplies the default choices.

Sleep checks are private. The GM interface records the result and explains the consequence:

- Safe sleep can reduce Exhaustion when the character was fed and watered.
- Supply shortages can prevent recovery even after a successful check.
- Poor sleep can increase Exhaustion.

## If a request does not appear

1. Confirm you are logged in and active.
2. Confirm your user owns the assigned character.
3. Ask the GM to resend or reroll the relevant step.
4. Reload the Foundry world if the module was just installed or updated.
