---
title: Game Master Travel Rules Reference
description: Detailed rules for movement, weather, encounters, discoveries, supplies, and camp in Morelord Journeys.
slug: morelord-journeys/gm-travel-rules
product: morelord-journeys
audience: game-master
version: 0.2.0
foundry: 14
order: 15
---

# Morelord Journeys: Game Master Travel Rules Reference

> GM reference for the travel-rules update introduced in Morelord Journeys 0.2.0.

Journeys measures distance in thirds of a normal travel day. Three thirds equal approximately 24 miles. Pace gives the party its starting movement for the day; weather, discoveries, navigation, and a forced march then change that amount.

Journeys always shows the calculation before changing the route distance. It also retains the route's original planned length, so a detour or mistake never erases the party's original expectation.

When creating a route, enter its length as whole **Days** plus **Additional Thirds** of 0, ⅓, or ⅔. For example, 4 days plus ⅔ is stored and displayed as `4⅔ days`. Journeys stores integer thirds internally, so fractional route lengths never depend on decimal rounding.

## Preparing a route

Every route has five ratings.

| Rating | What it controls |
| --- | --- |
| Length | The route's distance in travel days; each day contains three thirds |
| Danger | How strongly encounter rolls shift toward Major Encounters or Night Attacks |
| Discovery DC | The Observer's Perception DC for noticing optional leads |
| Resources DC | Each traveler's Survival DC for finding food and a water source |
| Navigation DC | The Navigator's Survival DC for making progress without becoming lost |

A safe road is normally longer, has low Danger, few discoveries, poor foraging, and easy or automatic navigation. A shortcut may be shorter and rich in resources but more dangerous and difficult to navigate.

## The travel day

Journeys uses this order:

1. Weather
2. Pace
3. Day Encounter
4. Discovery
5. Navigation
6. Press On
7. Foraging and Supplies
8. Camp
9. Sleep and Shelter

The GM can disable phases in world settings. Journeys labels disabled phases as skipped in the expedition log. Disabling a phase does not invent a hidden result: for example, disabling Navigation treats it as an automatic success, while disabling Foraging requires the GM to mark food and water manually if those needs remain enabled.

## Weather

Weather has two rolls. First, Journeys prompts you to determine whether extreme weather occurs. Roll `1d20`; on a 1, the day has extreme weather. Then roll or select a compatible forecast.

An extreme day cannot produce an ordinary forecast such as Clear Skies. Journeys limits the second roll to extreme results:

| Spring and summer | Fall and winter |
| --- | --- |
| Gale-force winds | Blizzard |
| Thunderstorm | Freezing rain |
| Flash flooding | Ice storm |
| Heat wave | Cold snap |

Extreme weather has three automatic effects:

- Subtract one progress third.
- Impose disadvantage on the Navigator's Survival check.
- Add 5 to every sleep DC that night.

You may override either roll when the route or story requires it. Journeys records the rolled result and your final selection.

## Pace

Ask the party to choose its pace after seeing the weather.

### Stopped

The party gains no route movement. Travelers have advantage on foraging and sleep checks, and the day's encounter Danger is reduced. Journeys does not make a daytime travel encounter check.

### Slow

The party gains two progress thirds. Travelers have advantage on foraging checks. When a daytime encounter occurs, the party notices other creatures first and may try to approach stealthily or bypass them.

### Normal

The party gains three progress thirds with no additional pace effect.

### Fast

The party gains four progress thirds. Travelers have disadvantage on foraging checks. Subtract 5 from the party's highest passive Perception when resolving daytime encounter detection.

## Day encounters

Journeys normally makes one encounter check for a day of travel, representing approximately 24–25 miles of exposure. This is not automatically a combat roll.

| Modified d100 | Result |
| --- | --- |
| 1–40 | No encounter |
| 41–60 | Signs and foreshadowing |
| 61–85 | Minor encounter: hazard, discovery, or social scene |
| 86+ | Major encounter: combat or major story moment |

Danger shifts the roll upward:

| Danger | Typical region | Modifier |
| ---: | --- | ---: |
| 0 | Protected or exceptionally quiet | -10 |
| 1 | Safe or civilized | +0 |
| 2 | Untamed wilderness | +5 |
| 3 | Hostile territory | +10 |
| 4 | Extremely dangerous | +15 |
| 5 | Lethal or otherworldly | +20 |

Journeys applies every applicable situational modifier known from the route, pace, and weather:

| Situation | Modifier |
| --- | ---: |
| Road or high traffic | +5 |
| Favorable weather | -5 |
| Bad weather or low visibility | +5 |
| Stealthy travel or strong party awareness | -10 |

Journeys shows the raw roll, modifiers, modified result, and outcome. You can let a player make the encounter roll when the campaign uses player-facing encounter checks.

### Detection and surprise

Journeys displays the party's highest passive Perception. Fast pace reduces that value by 5.

When you construct an encounter in Morelord Encounters, its Stealth action uses the worst Stealth modifier among the chosen creatures. Compare that result with the displayed passive Perception. When the two values are within 5 of each other, neither side is surprised. Journeys records the comparison but does not begin combat automatically.

### What the noncombat results mean

- **Signs and foreshadowing** reveal that something is nearby or has passed through: tracks, damage, discarded gear, distant calls, smoke, or frightened travelers.
- **Minor encounters** create a decision without demanding a major battle: a blocked crossing, dangerous terrain, an argument between NPCs, a wounded creature, or a localized magical effect.
- **Major encounters** can be combat, but may instead be a major faction scene, severe hazard, or campaign-changing discovery.

## Discoveries

The Observer rolls Wisdom (Perception) against the route's Discovery DC. Success means the Observer notices a lead. Do not reveal the discovery immediately; give the party a clue and let it decide whether to spend time investigating.

Ignoring the clue costs nothing. Any duration greater than zero means the lead was pursued. Enter whole days plus zero, one, or two additional thirds, allowing a discovery to consume anything from one third to a multi-day dungeon expedition.

Use the optional d100 prompt when you need inspiration:

| d100 | Lead |
| --- | --- |
| 01–10 | Fresh tracks leave the main route |
| 11–20 | Smoke, light, or movement is visible in the distance |
| 21–30 | An unexplained sound carries across the terrain |
| 31–40 | Blood, remains, or abandoned equipment marks a side trail |
| 41–50 | An unusual cave, spring, grove, or geological feature appears |
| 51–60 | Ruined or worked stone is visible nearby |
| 61–70 | Wildlife behaves strangely or gathers around a location |
| 71–80 | A camp, banner, message, shrine, or trade marker is found |
| 81–90 | Signs warn of a hazard, predator, or approaching disaster |
| 91–100 | A magical anomaly alters light, weather, plants, or tracks |

Examples of useful discovery leads:

- A line of boot prints suddenly leaves the road without returning.
- Black smoke rises beyond a ridge while the air smells faintly of resin.
- A bell rings at irregular intervals from somewhere below ground.
- A broken wagon wheel bears the crest of a friendly faction.
- Every tree in a small grove leans toward the same moss-covered stone.
- Ravens circle a clearing but refuse to land.
- A fresh trail marker uses a symbol one traveler recognizes from home.
- A stream runs warm despite snow on both banks.
- A rusted sword is embedded point-first in the center of the path.
- A child's handwriting warns travelers not to follow the lights.
- The party finds a campsite whose ashes are cold but whose food is untouched.
- Footprints on the muddy road end in the middle of an open field.

## Navigation

The Navigator rolls Wisdom (Survival) against the route's Navigation DC. Extreme weather imposes disadvantage. A reliable map, good directions, or route knowledge may grant advantage.

| Result | Route effect |
| --- | --- |
| Meets or exceeds the DC | Apply the day's movement |
| Fails by 1–4 | The party becomes lost and makes no route progress |
| Fails by 5 or more | Turned Around; add one full day to the distance remaining |

Example: the party chooses Fast pace for four thirds, pursues a discovery for a cost of one third, and loses another third to weather. Its movement is two thirds. If Navigation succeeds, subtract two thirds from the route. If it becomes Lost, route distance does not change. If it is Turned Around, add one full day to the route.

## Press On

After Navigation, the party may travel for two additional hours. Pressing on adds one progress third.

Every traveler makes a DC 12 Constitution saving throw. A failed traveler gains one Exhaustion. Journeys sends each owning player a private roll request and shows you when all results are complete. You can resolve a request for an absent player.

Pressing on is not available while Stopped. The save-request control appears only after the GM selects Press On. Every pending request can be resent or resolved manually by the GM.

## Foraging and food

Every traveler rolls Wisdom (Survival) against the route's Resources DC.

- A successful traveler finds a full meal and does not consume a ration.
- A failed traveler consumes one ration from the expedition's pooled food.
- The pool includes recognized food carried by every traveler and the Group actor.
- Journeys shows which items and actors will supply the rations before you confirm consumption.
- If no recognized pooled ration is available, use **Manual Ration** when the party has a valid supply Journeys cannot identify.

Journeys tracks consecutive days without a full meal. A character can go `3 + Constitution modifier` days without food. On the next hungry day, the character makes a DC 10 Constitution save, increasing by 5 on each additional consecutive hungry day; failure adds one Exhaustion. Eating a full day's ration resets the counter. These outcomes begin automatically when daily supplies are confirmed.

The Foraging panel shows each traveler's roll, meal status, hunger counter, starvation threshold, supply source, and any pending consequence.

## Water

A Medium traveler requires four pints per day. A traveler who receives none of the required daily water automatically gains one Exhaustion that day; no saving throw is made. This consequence is applied as soon as daily supplies are confirmed.

A Medium traveler requires four pints of water per day.

The Supply Manifest displays one **Water** for each complete four-pint daily unit, while allocation details continue to show exact pints.

If any traveler succeeds on the day's foraging check, the party finds a water source. Everyone drinks enough, and everyone may refill recognized water containers. Journeys does not consume carried water in that case.

If nobody finds water, Journeys consumes four pints per traveler from the expedition's pooled water. The pool includes recognized water carried by every traveler and the Group actor. Journeys previews every source before consumption. A waterskin or flask is a container, not water by itself.

A traveler who does not receive four pints gains one Exhaustion automatically. Use **Manual Water** when the party has access to water that is not represented by a recognized Foundry item.

## Camp setup

The Camp phase establishes:

- Whether the party lights a fire.
- The watch order.
- Each traveler's camp action.
- Whether the derived setup is poor, ordinary, or excellent.

The following Sleep & Shelter phase handles personal tents, bedrolls, blankets, interruptions, sleep saves, and Peaceful Rest choices.

A campfire is required for Craft, Cook, and Prepare. It makes camp setup excellent (-10) while its visibility adds +5, for a combined -5 night modifier. A camp with neither fire nor any tent is poor (+10). All other camps are ordinary.

## Camp actions

| Action | Resolution |
| --- | --- |
| Take a Watch | Full attention; make night Perception normally if this watch is selected |
| Craft | Resolve crafting manually or through Craftworks; Perception is at disadvantage |
| Cook | Resolve verbally; on success may remove one Exhaustion from up to two chosen characters; Perception is at disadvantage |
| Prepare | Resolve the preparation benefit verbally; Perception is at disadvantage |
| Slumber | Character sleeps; Perception automatically fails; completing the required sleep may grant a Peaceful Rest choice |
| Task | Resolve the task verbally; Perception is normally at disadvantage unless the task assists observation |

Journeys logs manual benefits but does not automatically apply Prepare, Cook, Slumber, or Peaceful Rest benefits to actors.

Any traveler who is not assigned to **Take a Watch** receives the same rest treatment as Slumber. Watch assignments save automatically; there is no separate Save Watch Order step.

## Night encounters

Journeys makes one night encounter roll for the whole camp.

| Modified d100 | Result |
| --- | --- |
| 1–30 | Peaceful Rest |
| 31–60 | Uneventful Night |
| 61–85 | Minor encounter: hazard, discovery, or social scene |
| 86+ | Night attack; base surprise DC 15 |

Add the route's Danger modifier and every applicable situational modifier:

| Situation | Modifier |
| --- | ---: |
| Road or high traffic | +5 |
| Favorable weather | -5 |
| Bad weather or low visibility | +5 |
| No fire and no tents | +10 |
| Campfire: excellent setup and visibility | -5 net |

If the result produces an encounter, Journeys rolls a die with sides equal to the number of watches. The selected watcher makes an active Perception check, modified by their camp action. Morelord Encounters supplies the opposing Stealth check.

## Peaceful Rest

When the night result is Peaceful Rest, each eligible player chooses one benefit:

- Advantage on the first saving throw of the next day.
- Remove one additional level of Exhaustion.
- Gain Heroic Inspiration.

Journeys records the selection but does not apply it mechanically. A character using Slumber can also receive a Peaceful Rest selection after completing the sleep required for a Long Rest.

## Sleep and shelter

Every traveler makes a Constitution saving throw to sleep. The base DC is 10.

| Modifier | DC change |
| --- | ---: |
| Tent owned by this traveler | -5 |
| Bedroll owned by this traveler | -2 |
| Blanket owned by this traveler in cold weather | -1 |
| Extreme weather | +5 |

Sleeping supplies are not pooled. A traveler may use only a tent, bedroll, or blanket in that traveler's own inventory. Equipment owned by another traveler or the Group actor never appears as an option. Even if a tent could physically sleep two creatures, Journeys applies its shelter modifier only to the owner.

Journeys shows the complete calculation before rolling. For example:

`Base 10 - Tent 5 - Bedroll 2 + Extreme weather 5 = DC 8`

Sleep starts at eight hours minus two hours for each watch taken. Journeys records interruptions in hours. A Night Attack prefills one combat-interruption hour; a Minor encounter adds none unless the GM determines it became combat, after which the GM enters the actual interrupted hours. A Long Rest requires a successful sleep check, at least six hours of sleep, and less than one hour of interruption. Peaceful Rest reduces the sleep DC by 5. A completed Long Rest removes one Exhaustion only when the traveler ate a full meal and drank four pints of water.

When a traveler fails to complete a Long Rest, Journeys uses Xanathar-style sleep deprivation by default: DC 10 Constitution save after the first missed rest, increasing by 5 for each consecutive missed rest. Failure adds one Exhaustion. The world setting **Do not add Exhaustion level for lack of sleep** disables that save and Exhaustion, but the character still receives no Long Rest benefits.

The result records the roll, save modifier, every DC modifier, final DC, food and water status, and Exhaustion change.

## Reading the help buttons

Orange question-mark buttons appear beside consequential options. Each help panel explains:

- What Journeys rolls or asks you to decide.
- The exact calculation and result bands.
- Which modifiers are automatic.
- Which values you may override.
- A worked example.
- Whether Journeys applies the result or only records a manual benefit.

Use these panels during play whenever the party asks why a result or DC changed. The same calculation is preserved in the Expedition Log.

## What Journeys does not automate

Journeys does not enforce encumbrance, begin combat, apply Peaceful Rest choices, or automatically resolve the narrative effects of Craft, Cook, Prepare, Slumber, and Task. It continues to use the D&D 5e actor's existing Exhaustion value and system-defined Exhaustion effects.
