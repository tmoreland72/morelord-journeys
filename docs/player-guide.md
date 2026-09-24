---
title: Player Guide
description: Respond to journey checks, manage travel supplies, and resolve camp watches as a player.
slug: morelord-journeys/player-guide
product: morelord-journeys
audience: player
version: 0.3.6
foundry: 14
order: 20
---

# Morelord Journeys: Player Guide

Morelord Journeys gives players direct responsibility for the checks their characters make during travel. When the GM requests checks, a persistent public chat card lists the participating characters together. Each player can use the controls for their assigned character; the GM can roll for any character, including after a player disconnects.

## Before departure

Keep travel supplies on your character or in the shared party Group inventory.

- Food and water carried by travelers and the Group actor are pooled for the expedition.
- Water is tracked as `Water (Pint)` quantity; a Medium traveler needs four pints when no source is found.
- Waterskins and flasks are containers and do not count as water by themselves.
- Tents, bedrolls, and blankets are used during Sleep & Shelter, but only by the traveler who personally owns them.

You may place `Water (Pint)` inside a waterskin. Journeys counts the contained water item and consumes its quantity when needed.

## Player roll requests

Keep the Foundry world open during the expedition. One grouped request card identifies the characters, purpose, and each applicable DC. Day encounter, foraging, Press On, sleep deprivation, and watch checks use this grouped layout. Single-character navigation and discovery checks use the same controls.

Choose DIS, Roll, or ADV on your character’s row (encounter dice use a single Roll button). Your controls immediately become centered **Completed** text, and other characters can roll while your dice animate. If a request is rejected or cancelled, your controls return for retry. The result returns to Journeys after the dice finish; a reload recovers saved dice without rerolling. Resending a pending request reuses its card. Request cards are public; encounter outcomes remain GM-only.

## Discovery checks

The Observer rolls Perception to notice discoveries and opportunities along the route. The GM decides whether the party pursues a lead after seeing the result.

## Foraging checks

Every traveler may receive a Survival request during Foraging. Success reduces the supplies needed from inventory. The GM resolves allocation and shortages after all travelers respond.

## Navigation checks

The Navigator rolls Survival against the route's Navigation DC. The result is recorded in the Expedition Log so the party can see what happened during the day.

## Encounter rolls

Each participating character receives one daytime encounter die selected by Danger (0–5: d20, d12, d10, d8, d6, d4). Only the GM sees the dice and encounter count. A 1 triggers an encounter; maximums cancel encounters except on d4 and d6.

## Camp watches

The GM uses Roll Night Encounter directly in Journeys; no player request is created for the night encounter dice. Journeys rolls once per watch, or once per hour if the GM enables hourly night checks. After cancellation, each affected watch receives a Perception request with the surviving encounter times. One Perception result covers that watch.

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

Journeys uses 2024 Long Rest timing without a sleep check. A normal rest needs eight hours, including at least six hours asleep and at most two hours of light activity such as standing watch. Trance uses four hours of meditation; the GM can override the character's required hours.

The GM confirms eligibility at the start (at least 1 HP and sixteen hours since the previous Long Rest ended). Camp assignments determine when each traveler sleeps, watches, or works. Enter the encounter's duration, number of rest-breaking interruptions, and time within its watch. Initiative, damage, a leveled spell, or an hour of physical exertion interrupt an unfinished rest. Each interruption adds one recovery hour; time spent interrupted does not count as rest. Add extra sleep or meditation after Watch 4 when needed. Unknown event timing defaults to the beginning of its watch.

A later event cannot cancel a completed rest. For example, an elf standing Watch 1 and meditating through Watches 2 and 3 finishes before a Watch 4 encounter. Rest Results explain sleep received, interruptions, missing rest time, and Exhaustion in bullet points. Saved results from earlier rules remain labeled historical results and are not recalculated.

Shelter equipment is recorded for camp planning and does not change rest timing. The existing supply rule still prevents Exhaustion recovery when food or water is missing. The optional Xanathar-style deprivation save remains separate: a missed rest starts at DC 10 and increases by 5 on consecutive missed rests. Enable **Do not add Exhaustion for lack of sleep** to disable that save and its Exhaustion. Offline or disconnected players' pending saves can be resolved by the GM.

Journeys applies its recorded Exhaustion change and Heroic Inspiration selections. Apply HP, spell-slot, and other native Long Rest recovery through the character sheet, avoiding a second Exhaustion reduction. Other Peaceful Rest choices remain manual; the world clock is not advanced.

## If a request does not appear

1. Confirm you are logged in and active.
2. Confirm your user owns the assigned character.
3. Ask the GM to resend or reroll the relevant step.
4. Reload the Foundry world if the module was just installed or updated.

## Automatic checks and personal activity time

When the effective DC is zero, Journeys resolves the check without opening a player roll dialog. Rest uses 2024 timing without a sleep check. Ordinary foraging rewards and food or water consequences continue to apply.

The GM may provide personal activity hours and Location capabilities for the travel day. If Downtime is enabled, eligible Projects can use that travel context; ask the GM which activities are available. Character portraits help distinguish assignments when you control more than one traveler.
