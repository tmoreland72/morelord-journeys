<!-- Historical implementation plan; current behavior is documented in gm-manual.md and gm-travel-rules-reference.md. -->

> Superseded daytime encounter design: daytime checks now use a configurable die per traveler per Danger check/day, with player-triggered GM-only results. Ones add encounters and maximum rolls cancel them. Route Traffic has been removed. Daily route ratings can change before each travel day. Older d100 daytime proposals below are retained as design history, not current rules.

# Travel Rules Alignment Implementation Plan

Status: Pre-implementation specification  
Target: Morelord Journeys after 0.1.0  
Source rules: *Travel Guide Summary*, with the product decisions recorded below taking precedence

## Purpose

This document defines the mechanical and interface changes required before implementation begins. The goal is to align Morelord Journeys with the travel procedure in the Travel Guide Summary while retaining Foundry automation, player-owned rolls, the existing exhaustion model, whole-number presentation, and optional Morelord integrations.

The current phase order remains:

1. Weather
2. Pace
3. Encounters
4. Discovery
5. Navigation
6. Press On
7. Foraging
8. Camp
9. Day Complete

Individual phases may be disabled in world settings. Disabled phases are recorded as skipped and do not block day completion.

## Rules decisions

### Distance and journey duration

- One normal travel day equals three progress thirds, approximately 24 miles.
- A route's initial length may include whole days plus 0, 1, or 2 additional thirds.
- Route setup uses separate **Days** and **Additional Thirds** controls; GMs never need to enter a decimal.
- The interface presents the remaining journey in days and thirds rather than showing elapsed progress as a decimal.
- Each travel day calculates a net distance change from pace, weather, discoveries, navigation, and forced marching.
- Positive distance reduces the route distance remaining. Negative distance increases it.
- Distance remaining is never silently converted into an entire extra day.
- The original planned route length remains visible beside the current remaining distance.
- Arrival occurs when distance remaining reaches zero or less. Excess progress is recorded but not carried to another journey.

Recommended display examples:

- `2⅓ days remaining (original route: 5 days)`
- `Today: 1⅓ days gained - ⅓ weather delay = 1 day advanced`
- `Navigation reversed the party: ⅔ day added to the route`

Recommended route input example:

- **Days:** `4`; **Additional Thirds:** `2/3`; stored length: `14` thirds; displayed length: `4⅔ days`.

The route editor must accept lengths from `⅓ day` through `100 days` (or the existing configured maximum) in one-third increments. Validation requires a non-negative whole-day value, an additional-thirds value of 0, 1, or 2, and a combined length of at least one third. Existing whole-day routes continue to load with Additional Thirds set to zero.

#### Data model

`lengthSteps` remains the canonical planned distance. Add or normalize these fields:

```js
{
  plannedLengthSteps: 15,
  remainingSteps: 15,
  traveledSteps: 0,
  currentDay: {
    baseProgressSteps: 3,
    progressModifiers: [],
    provisionalProgressSteps: 3,
    appliedProgressSteps: 0
  }
}
```

Existing journeys migrate from `progressSteps` and `routeExtensionDays` into `remainingSteps`. Migration must preserve the current displayed estimate and original route length.

### Pace

| Pace | Base movement | Additional rules |
| --- | ---: | --- |
| Stopped | 0 thirds | Advantage on foraging and sleep checks; reduce the day's Danger modifier by one step; no daytime travel encounter check |
| Slow | 2 thirds | Advantage on foraging; party notices daytime creatures first and may attempt to bypass or approach with Stealth |
| Normal | 3 thirds | No pace modifier |
| Fast | 4 thirds | Disadvantage on foraging; highest party passive Perception is reduced by 5 for daytime encounter detection |

Pace effects must be shown before the GM confirms the phase. The phase help panel must explain both movement and roll effects.

### Navigation

The Navigator makes one Wisdom (Survival) check against the route's Navigation DC.

| Result | Effect |
| --- | --- |
| Success | Apply the day's net movement normally |
| Failure by 1–4 | The party becomes lost and makes no route progress that day |
| Failure by 5 or more | The party becomes turned around; the magnitude of the day's positive net movement is added to distance remaining |

Clarifications:

- A route with no Navigation DC succeeds automatically.
- Extreme weather imposes disadvantage on the check.
- Maps, reliable directions, route knowledge, and similar preparation may grant advantage at GM discretion.
- Advantage and disadvantage cancel normally.
- Navigation is resolved before Press On and Foraging because the existing workflow order is retained.
- A forced march does not rescue a failed navigation check. On a reversed result, its additional movement also carries the party farther in the wrong direction.
- The UI shows total, DC, margin, outcome, and resulting distance calculation.

### Discovery

The Observer makes one Wisdom (Perception) check against the route's Discovery DC. Success reveals a lead, not the discovery itself. The party decides whether to pursue it.

- Ignoring a lead costs no time.
- Pursuing a lead subtracts one progress third by default.
- The GM may override the cost to 0, 1, 2, or 3 thirds when the fiction warrants it.
- Discovery time is included in the day's navigation outcome.

The Discovery panel must include:

- A concise GM reminder to present a clue rather than reveal the destination.
- At least twelve examples spanning tracks, smoke, ruins, sounds, strange weather, abandoned gear, creatures, magical effects, and social opportunities.
- An optional d100 discovery-lead roll.
- A configurable world or route RollTable override when available.

Proposed built-in d100 categories:

| d100 | Lead category | Example |
| --- | --- | --- |
| 01–10 | Tracks or trail | Fresh prints leave the road toward high ground |
| 11–20 | Distant sight | A thin column of smoke rises beyond the ridge |
| 21–30 | Sound | Bells or hammering carry from an unseen valley |
| 31–40 | Remains | Broken equipment and blood mark a side trail |
| 41–50 | Natural feature | An unusual spring, cave, or grove lies nearby |
| 51–60 | Ruin or structure | Worked stone is visible beneath the undergrowth |
| 61–70 | Creature activity | Scavengers circle or animals flee a location |
| 71–80 | Social sign | A campfire, banner, message, or trade marker is found |
| 81–90 | Hazard warning | The party finds signs of a flood, fire, collapse, or predator |
| 91–100 | Magical anomaly | Light, altered plants, impossible cold, or warped tracks appear |

These results are prompts only; the GM supplies campaign-specific details and rewards.

### Forced march (Press On)

- Pressing on adds one progress third, representing two additional hours of travel.
- Every traveler must make a DC 12 Constitution saving throw.
- Each owning player receives a roll request. The GM may resolve requests for absent players.
- Failure adds one Exhaustion using the existing Journeys/D&D system exhaustion value.
- Results are private by default and summarized to the GM.
- The phase cannot complete until every save is resolved or explicitly waived by the GM.
- Pressing on while stopped is not allowed.

### Weather

Weather resolution is a two-stage procedure.

1. Prompt the GM to roll the extreme-weather check: `1d20`; a result of 1 indicates extreme weather.
2. Roll the weather forecast from a list compatible with the extreme/non-extreme result.

The GM may override either result. If Extreme Weather is enabled manually, ordinary results such as Clear Skies must be removed from the forecast options.

Built-in extreme forecasts:

- Spring/summer: gale-force winds, thunderstorm, flash flooding, heat wave.
- Fall/winter: blizzard, freezing rain, ice storm, cold snap.

Extreme weather:

- Subtracts one progress third.
- Imposes disadvantage on Navigation.
- Adds 5 to every sleep DC.

The system needs season selection or a GM-selectable seasonal table. Route-specific weather tables remain supported, but must classify each result as ordinary or extreme.

At Camp, each traveler row must display a sleep DC breakdown, for example:

`Base 10 - Tent 5 - Bedroll 2 + Extreme weather 5 = DC 8`

### Daytime encounters

Daytime encounters use the Travel Guide Summary's range of outcomes rather than treating every result as combat.

#### Cadence

- Default: one daytime encounter check for approximately 24–25 miles of intended movement.
- A stopped day has no daytime travel encounter check.
- A day with less than one day of movement still receives its single daily check because it represents exposure during the travel day.
- The GM may add, skip, or reroll a check.
- Player-rolled checks remain a world setting for campaigns such as Drakkenheim. The player roll determines the same d100 result and uses the same modifiers.

#### Base table

| Modified d100 | Outcome |
| --- | --- |
| 1–40 | No encounter |
| 41–60 | Signs and foreshadowing |
| 61–85 | Minor encounter: hazard, discovery, or social scene |
| 86+ | Major encounter: combat or major story event |

#### Danger adjustment

Proposed initial mapping:

| Danger | Modifier |
| ---: | ---: |
| 0 | -10 |
| 1 | +0 |
| 2 | +5 |
| 3 | +10 |
| 4 | +15 |
| 5 | +20 |

Adding Danger to the roll increases Major results and reduces No Encounter, Signs, and Minor results naturally. This mapping must be stored as constants and covered by tests so it can be tuned without rewriting the workflow.

Apply every applicable situational modifier in addition to Danger. Route creation records road/high-traffic exposure explicitly rather than inferring it from Danger:

| Situation | Modifier |
| --- | ---: |
| Road or high traffic | +5 |
| Favorable weather | -5 |
| Bad weather or low visibility | +5 |
| Stealthy travel or strong party awareness | -10 |

The GM sees the raw roll, every modifier, the final total, and the outcome band.

#### Detection and surprise

- Display the party's highest passive Perception to the GM, including the Fast pace -5 penalty.
- Morelord Encounters provides the action to roll Stealth for the selected encounter.
- The encounter Stealth result uses the lowest Stealth modifier among the selected creatures.
- Compare encounter Stealth against the displayed party passive Perception.
- If the values are within 5 of each other, neither side is surprised.
- Journeys sends the versioned detection payload to the implemented Encounters-side Stealth feature.

Proposed integration result:

```js
{
  encounterId,
  lowestStealthModifier,
  stealthTotal,
  passivePerception,
  difference,
  surpriseOutcome
}
```

### Night encounters

Camp uses one night encounter roll, not one roll per watch.

#### Camp inputs

- Watch order, with any number of watches greater than zero.
- Whether the camp has a fire.
- One camp action per traveler/watch assignment.
- Derived camp quality based on fire and tents.
- Weather and route Danger.

#### Base table

| Modified d100 | Outcome |
| --- | --- |
| 1–30 | Peaceful Rest |
| 31–60 | Uneventful Night |
| 61–85 | Minor encounter: hazard, discovery, or social scene |
| 86+ | Night attack; base surprise DC 15 |

The overlap printed in the source table is normalized so Minor ends at 85 and Night Attack begins at 86.

Apply Danger plus every applicable situational modifier:

| Situation | Modifier |
| --- | ---: |
| Danger 0–5 | Same Danger mapping as daytime encounters |
| Road or high traffic | +5 |
| Favorable weather | -5 |
| Bad weather or low visibility | +5 |
| No campfire and no tents | +10 |
| Campfire: excellent setup -10 and visibility +5 | -5 net |

A campfire is required for Craft, Cook, and Prepare. Watch and camp-action assignments save automatically.

If an encounter occurs, roll `1dN`, where `N` is the number of watches, to choose the affected watch. Display the selected watch, assigned character, and camp action.

The watcher makes an active Wisdom (Perception) check. Proposed camp-action attention adjustments:

| Camp action | Perception effect |
| --- | --- |
| Take a Watch | Normal roll |
| Craft | Disadvantage |
| Cook | Disadvantage |
| Prepare | Disadvantage |
| Task | Disadvantage unless the GM rules the task supports observation |
| Slumber | Automatic failure / Passive Perception 0 |

A campfire may also impose disadvantage where the GM determines glare limits vision. The UI must explain the applied effect before the roll.

Morelord Encounters handles the opposing Stealth check. Journeys records the returned result beside the watcher's Perception result.

### Peaceful Rest

When the night result is Peaceful Rest, each eligible player is prompted to choose one benefit:

- Advantage on the first saving throw of the next day.
- Remove one additional level of Exhaustion.
- Gain Heroic Inspiration.

Journeys records the choice in the expedition log but does not mechanically alter the actor. The player and GM receive a reminder that the benefit must be applied manually.

Slumber may also grant access to this choice when the character receives the sleep required for a Long Rest, even if the overall night roll was not Peaceful Rest. Slumber remains a verbal/manual camp action.

A traveler not assigned to Take a Watch receives the same rest treatment as Slumber.

### Foraging, food, and water

Each traveler makes a Wisdom (Survival) check against the route's Resources DC.

#### Foraging results

- A successful character finds enough food for that character's full meal and does not consume a ration.
- A failed character must consume one ration.
- All recognized food carried by travelers or the Group actor forms one expedition food pool.
- Rations may be consumed from any pooled source. The allocation preview shows the item and actor source before the GM confirms consumption.
- If the expedition pool has no ration, pause and offer the GM a Manual Ration option. This records an externally supplied or unrecognized ration without modifying an unidentified item.
- If at least one traveler succeeds, water is available to everyone for that day and every traveler may refill recognized water containers.

The request said that a successful forager “must consume a ration,” but the Travel Guide Summary says a failed forager consumes one. This specification follows the source rule and the apparent intended meaning.

#### Hunger

- Track `daysWithoutFood` per traveler in Journeys flags or journey state.
- Eating a full meal resets the counter to zero.
- At the end of a day without a full meal, increment the counter.
- A traveler can go `3 + Constitution modifier` days without food, with a minimum grace period of zero days.
- Once the counter exceeds that threshold, request a DC 10 Constitution save, increasing by 5 for each additional consecutive hungry day; failure adds one Exhaustion.
- Start these checks automatically after daily supplies are confirmed; do not require a separate consequence-resolution button.

The GM must see the current counter, threshold, whether a full meal was obtained, and any Exhaustion consequence.

#### Water

- A Medium traveler requires 4 pints per day.
- Store the standard requirement as a configurable rule constant so later versions can adjust it by creature size.
- If foraging finds water, the daily requirement is satisfied and recognized containers can be marked/refilled to capacity without consuming party water inventory.
- Otherwise consume 4 pints per traveler from one expedition-wide pool containing recognized water carried by any traveler or the Group actor.
- The allocation preview shows every source item before the GM confirms consumption.
- The Manual Water option handles supplies not represented by recognized Foundry items.
- A traveler who does not receive 4 pints gains one Exhaustion automatically at the end of the day.
- Partial water is recorded but does not prevent the Exhaustion consequence under this rule.

### Sleep and shelter

Sleep resolution follows the travel summary's outcome model while retaining Journeys shelter modifiers.

- Base sleep check: Constitution saving throw, DC 10.
- Tent owned by the sleeping traveler: -5 DC.
- Bedroll owned by the sleeping traveler: -2 DC.
- Blanket owned by the sleeping traveler in cold weather: -1 DC.
- Shelter is never pooled. A traveler cannot select a tent, bedroll, or blanket owned by another traveler or held by the Group actor.
- A tent's physical capacity does not make it shareable for Journeys supply allocation; only its owner receives its modifier.
- Extreme weather: +5 DC.
- Additional situational modifiers must be visible and GM-adjustable.
- Successful sleep removes one Exhaustion if the traveler ate a full meal and drank the required water.
- Successful sleep does not remove Exhaustion when either need was unmet.
- Start at eight sleep hours minus two hours for every watch taken, and track combat interruptions in hours. A Night Attack prefills one hour; Minor encounters add none unless combat occurs. A Long Rest requires a successful sleep check, at least six hours of sleep, and less than one hour of interruption. Peaceful Rest reduces the sleep DC by 5.
- A missed Long Rest uses a DC 10 Xanathar-style Constitution save, increasing by 5 per consecutive missed rest; failure adds one Exhaustion.
- The world setting **Do not add Exhaustion level for lack of sleep** suppresses the deprivation save and Exhaustion but never grants Long Rest benefits.
- The existing system exhaustion value and effects remain authoritative.
- A character cannot receive contradictory results from Sleep and Slumber; Slumber changes available narrative/Peaceful Rest benefits, not the base sleep roll.

Every sleep result must show:

- Roll and Constitution save modifier.
- Base DC.
- Shelter, weather, and GM modifiers.
- Final DC.
- Food and water eligibility.
- Exhaustion change or reason no recovery occurred.

### Camp actions

- Prepare, Cook, and Slumber remain verbally adjudicated and are logged. Craft, Cook, and Prepare require a campfire.
- Craft and Task remain integration/reminder actions.
- Take a Watch avoids the attention penalty on a night Perception check.
- A successful Cook action may reduce one Exhaustion for up to two selected characters. Journeys records the selected recipients and GM-confirmed success but does not independently determine cooking success unless a later cooking subsystem is added.
- Slumber offers Peaceful Rest choices if the character completes the required sleep for a Long Rest.
- A traveler not assigned to Take a Watch receives the same rest treatment as Slumber.
- The UI must distinguish automatic mechanics, recorded manual effects, and reminders.

### Encumbrance and Exhaustion

- Journeys continues to ignore encumbrance.
- Journeys continues to use the D&D 5e actor's existing Exhaustion value and system-defined effects.
- Journeys does not implement the custom Exhaustion penalty table printed in the Travel Guide Summary.

## Configurable phase settings

Add world settings for:

- Enable Weather.
- Enable Pace.
- Enable Day Encounters.
- Enable Discovery.
- Enable Navigation.
- Enable Press On.
- Enable Foraging and Supplies.
- Enable Camp Actions.
- Enable Night Encounters.
- Enable Sleep and Shelter.

Dependencies:

- Disabling Camp skips Camp Actions, Night Encounters, and Sleep unless their controls are separately exposed.
- Disabling Foraging must not erase hunger/water state. The GM must manually mark daily food and water resolution or explicitly waive it.
- Disabling Pace assumes Normal pace for distance calculations.
- Disabling Navigation assumes navigation success.
- A disabled phase is visibly labeled `Skipped by world setting` in the expedition log.

Settings changes affect future phases and days; they must not rewrite completed log entries.

## Context help and GM transparency

Every consequential control receives an orange question-mark button. Selecting it opens contextual help without leaving the active phase.

Each help panel must contain:

1. What is being decided or rolled.
2. The exact formula or result bands.
3. Every automatic modifier currently applied.
4. Which values the GM may override.
5. At least one concrete example.
6. Whether Journeys applies the result mechanically or only records/reminds it.

Required help topics include route ratings, all pace options, weather stages, encounter cadence and bands, Danger, passive Perception, discoveries and pursuit costs, navigation margins, forced march, foraging, hunger, water, camp setup, campfire, watch selection, camp actions, Peaceful Rest, sleep DCs, shelter capacity, and Exhaustion.

The orange help control must use an accessible label such as `Explain Navigation outcomes`, support keyboard activation, and not rely on color alone.

## Morelord Encounters contract

Journeys requires a versioned semantic handoff for both daytime and night encounters. The request should include:

- Journey, route, day, and phase identifiers.
- Encounter outcome category.
- Terrain and weather context.
- Day/night context.
- Party passive Perception or watcher Perception result.
- Campfire and camp-action context for night encounters.
- A request that Encounters use the lowest selected-creature Stealth modifier.

Encounters returns the Stealth roll, modifier used, creature name or identifier responsible for that modifier, and surprise comparison. Journeys records the response but does not automate combat or actor conditions.

## Implementation sequence

1. Add settings and phase-skip behavior.
2. Migrate the progress model to remaining thirds and add calculation tests.
3. Implement Pace, Discovery, Navigation, Weather, and Press On rules.
4. Replace encounter dice with daytime d100 outcome resolution while retaining player rolling.
5. Replace per-watch camp encounters with one nightly d100 roll and random watch selection.
6. Add campfire, camp setup, action-attention effects, and Peaceful Rest choices.
7. Revise foraging, hunger counters, four-pint water requirements, refills, and manual supply resolution.
8. Revise sleep results and expose full DC breakdowns.
9. Add Morelord Encounters Stealth integration on both sides.
10. Add context-help coverage and update GM/player documentation.
11. Migrate saved journeys and run full regression tests.

## Acceptance criteria

- Every movement modifier is expressed and stored in thirds.
- A worked calculation in the UI reconciles exactly to the changed distance remaining.
- Slow, Fast, and Stopped effects influence the stated checks automatically.
- Navigation failures produce zero or reversed progress according to margin.
- Every forced-march traveler receives a DC 12 Constitution save request.
- Extreme weather cannot coexist with an ordinary clear forecast.
- Day and night d100 results show raw roll, modifiers, final result, and outcome.
- Only one night encounter roll occurs per camp, followed by a random affected-watch roll when required.
- Highest daytime passive Perception and night watcher Perception are visible to the GM.
- One successful forager satisfies party water needs and enables container refills.
- Food and water consumption can draw from any traveler or Group actor in the expedition pool.
- Sleep equipment choices expose only items owned by that traveler and never Group actor items.
- Medium travelers require four pints when no water source is found.
- Hunger thresholds survive reloads and reset after a full meal.
- Sleep rows show a complete DC calculation before rolling.
- Peaceful Rest choices are player-facing, logged, and explicitly manual.
- Disabled phases skip cleanly and remain visible in the log.
- Every consequential GM option has accessible orange contextual help.
- Existing journeys migrate without losing their original route estimate or completed history.

## Items to validate during implementation

The following choices are concrete defaults in this specification but should be easy to tune after playtesting:

- One daytime encounter check per travel day rather than multiple checks per Danger level.
- The proposed Danger modifiers from -10 to +20.
- Campfire's default +5 night encounter modifier.
- Disadvantage as the standard attention penalty for all non-Watch actions.
- Whether partial daily water should mitigate the automatic Exhaustion consequence.
