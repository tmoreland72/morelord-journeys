---
title: Game Master Travel Rules Reference
description: Detailed rules for movement, weather, encounters, discoveries, supplies, and camp in Morelord Journeys.
slug: morelord-journeys/gm-travel-rules
product: morelord-journeys
audience: game-master
version: 0.3.6
foundry: 14
order: 15
---

# Morelord Journeys: Game Master Travel Rules Reference

> GM reference for the travel-rules update introduced in Morelord Journeys 0.3.2.

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
- Record extreme weather for camp planning; it does not impose a 2024 sleep check.

You may override either roll when the route or story requires it. Journeys records the rolled result and your final selection.

## Pace

Ask the party to choose its pace after seeing the weather.

### Stopped

The party gains no route movement. Travelers have advantage on foraging checks, and the day's encounter Danger is reduced. Journeys does not make a daytime travel encounter check.

### Slow

The party gains two progress thirds. Travelers have advantage on foraging checks. When a daytime encounter occurs, the party notices other creatures first and may try to approach stealthily or bypass them.

### Normal

The party gains three progress thirds with no additional pace effect.

### Fast

The party gains four progress thirds. Travelers have disadvantage on foraging checks. Subtract 5 from the party's highest passive Perception when resolving daytime encounter detection.

## Day encounters

Danger selects the encounter die: 0 → d20, 1 → d12, 2 → d10, 3 → d8, 4 → d6, 5 → d4. Each traveler rolls once during the day, including at Danger 0. Each 1 triggers an encounter. Maximums cancel encounters across the pool, except on d4 and d6. The count cannot be negative. Stopped travel skips daytime checks. There is no configurable encounter die.

Players trigger their character’s rolls from private requests. Only the GM sees the results. Resolve every traveler before continuing. Route Traffic and the former daytime d100 modifiers no longer apply. Before beginning each day, update Daily Route Ratings for its environment; the values carry forward and each day retains its recorded ratings.

### Detection and surprise

Journeys displays the party's highest passive Perception. Fast pace reduces that value by 5.

When you construct an encounter in Morelord Encounters, its Stealth action uses the worst Stealth modifier among the chosen creatures. Compare that result with the displayed passive Perception. When the two values are within 5 of each other, neither side is surprised. Journeys records the comparison but does not begin combat automatically.

The encounter count does not prescribe severity or require combat. The GM chooses the encounters and records any resulting travel delay.

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

Every traveler makes a DC 12 Constitution saving throw. A failed traveler gains one Exhaustion. Journeys posts one public group request card with a separate Constitution save for each traveler and shows when all results are complete. Any GM can roll for a traveler, including after their player disconnects.

Pressing on is not available while Stopped. The save-request control appears only after the GM selects Press On. Every pending request can be resent or resolved manually by the GM.

## Foraging and food

Every traveler rolls Wisdom (Survival) against the route's Resources DC.

- A successful traveler finds a full meal and does not consume a ration.
- A failed traveler consumes one ration from the expedition's pooled food.
- The pool includes recognized food carried by every traveler and the Group actor.
- Journeys shows which items and actors will supply the rations before you confirm consumption.
- If no recognized pooled ration is available, use **Manual Ration** when the party has a valid supply Journeys cannot identify.

Journeys tracks consecutive days without a full meal. Days 1�4 without food request a daily Constitution save (default DC 10); failure adds one Exhaustion. Day 5 and each subsequent day without food automatically add one Exhaustion without a roll. Constitution does not alter this threshold. Send Save / GM Roll resends a pending request to the player or opens it for the GM when the player is offline, including after disconnecting. Eating a full day's ration resets the counter. These outcomes begin automatically when daily supplies are confirmed.

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

Use the same Danger die at night. By default, roll four dice, one for each two-hour watch. **Journeys Settings → Encounter Dice → Night encounter frequency** can instead select eight hourly checks. Roll the whole night as a pool before playing it out: a 1 triggers an encounter, or a 1 or 2 with a visible campfire. Maximums cancel the latest triggered periods first, except on d4 and d6. Surviving encounters retain their hour range and watch. Each affected watch gets one Perception check; Send Perception / GM Roll supports offline or disconnected owners. The GM chooses combat or non-combat and records each encounter’s actual rest interruptions. Weather, tents, and stopped travel do not modify these dice. The old d100 Peaceful Rest result is no longer generated; saved historical outcomes and existing rest benefits remain supported.

## Peaceful Rest

For saved legacy Peaceful Rest outcomes and eligible Slumber rest benefits, each eligible player chooses one benefit:

- Advantage on the first saving throw of the next day.
- Remove one additional level of Exhaustion.
- Gain Heroic Inspiration.

Journeys applies Heroic Inspiration to the character sheet when selected. It records the other choices for manual application. A character using Slumber can also receive a Peaceful Rest selection after completing the sleep required for a Long Rest.

## Sleep and shelter

Journeys uses 2024 Long Rest timing without a sleep check. A normal rest needs eight hours, including at least six hours asleep and at most two hours of light activity such as standing watch. Trance uses four hours of meditation; the GM can override the character's required hours.

The GM confirms eligibility at the start (at least 1 HP and sixteen hours since the previous Long Rest ended). Camp assignments determine when each traveler sleeps, watches, or works. Enter the encounter's duration, number of rest-breaking interruptions, and time within its watch. Initiative, damage, a leveled spell, or an hour of physical exertion interrupt an unfinished rest. Each interruption adds one recovery hour; time spent interrupted does not count as rest. Add extra sleep or meditation after Watch 4 when needed. Unknown event timing defaults to the beginning of its watch.

A later event cannot cancel a completed rest. For example, an elf standing Watch 1 and meditating through Watches 2 and 3 finishes before a Watch 4 encounter. Rest Results explain sleep received, interruptions, missing rest time, and Exhaustion in bullet points. Saved results from earlier rules remain labeled historical results and are not recalculated.

Shelter equipment is recorded for camp planning and does not change rest timing. The existing supply rule still prevents Exhaustion recovery when food or water is missing. The optional Xanathar-style deprivation save remains separate: a missed rest starts at DC 10 and increases by 5 on consecutive missed rests. Enable **Do not add Exhaustion for lack of sleep** to disable that save and its Exhaustion. Offline or disconnected players' pending saves can be resolved by the GM.

Journeys applies its recorded Exhaustion change and Heroic Inspiration selections. Apply HP, spell-slot, and other native Long Rest recovery through the character sheet, avoiding a second Exhaustion reduction. Other Peaceful Rest choices remain manual; the world clock is not advanced.

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

Journeys does not enforce encumbrance, begin combat, apply Peaceful Rest choices other than Heroic Inspiration, or automatically resolve the narrative effects of Craft, Cook, Prepare, Slumber, and Task. It continues to use the D&D 5e actor's existing Exhaustion value and system-defined Exhaustion effects.

## Zero-DC resolution

An effective DC of zero resolves as a success without a player roll request, while 2024 rest timing requires no sleep check. This does not bypass Long Rest eligibility, normal foraging rewards, or supply consequences.

### Current journey display and progress

The header shows the current or upcoming travel day, beginning at Day 1. Above Ready for the Road, Journey Progress displays Days Traveled, Days Remaining, Original Duration, and Current Duration in four Core cards. Current Duration is traveled plus remaining time.

Before starting a new day, the GM can expand **Adjust Remaining Travel**, enter whole days and thirds, and select **Apply Adjustment**. This changes remaining time and current duration, preserves original duration and earned progress, and records the old and new values in the Expedition Log. Zero remaining time marks arrival. Adjustments are unavailable while a travel day is underway.

Daily Route Ratings precede supplies. Weather checks and forecasts use two columns. Pace options express this module’s travel scale in miles: Slow 2/hour and 16/day, Normal 3/hour and 24/day, Fast 4/hour and 32/day, Stopped 0.

A triggered encounter is highlighted as combat or non-combat; the GM may close Journeys while resolving it and return afterward. Dice-count arithmetic is in Outcome Details, and phase help stays beside the section title.

Lost navigation removes base pace progress but balances delays against extra travel, with a minimum of zero travel credit. Thus a ⅓-day encounter delay plus ⅓-day Press On produces zero credit after a lost-navigation day. Previously completed historical logs are retained.
