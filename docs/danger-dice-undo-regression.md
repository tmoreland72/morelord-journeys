# Danger dice and Go Back regression

Follow Core's `IN-GAME-TESTING.md`. Use disposable journeys, characters, and supplies, never Demo1's prepared campaign. Live execution is still pending.

1. At Danger 0 through 5, request daytime rolls. Each traveler receives one d20/d12/d10/d8/d6/d4 respectively. Only GMs see dice. Check cancellation on d8 and larger, and no cancellation on d4/d6. Disconnect a player while pending and use Resend to roll as GM; duplicate submissions must not change the recorded count.
2. Open Settings: the old encounter die, d100 maximums, and modifier controls are absent. Select every watch, save/reopen, and repeat with every hour. Day frequency remains one check per traveler.
3. In camp, roll night checks with and without fire. Expect four watch dice or eight hourly dice. With fire, 1 and 2 trigger; otherwise only 1. Maximums on d8 and larger cancel the latest triggered periods first. Check all surviving times, including two encounters in the same watch. One Perception check covers each affected watch. Verify unwatched periods and player disconnect fallback. Run `runNightEncounterTimingTests` from `scripts/testing/night-encounter-timing.mjs` after a triggered encounter.
4. Change interruption duration/count/offset for separate encounters. Reopen and verify persistence. Advance and check the rest timeline retains both events. Open Morelord Encounters from each event and verify the selected watch's Perception and one encounter are passed through.
5. Begin a disposable day, resolve a weather delay, advance, then Go Back. Verify weather inputs/results and travel calculations reset to the step's entry checkpoint. Repeat through a completed day to verify distance, day number, and log restoration.
6. Record tracked food/water quantities, hunger flags, Exhaustion, and Inspiration. Resolve foraging with surplus rations/refills and consume supplies. Advance to camp, then Go Back. Verify quantities and flags return, generated ration items are removed, and unrelated character properties remain unchanged. Repeat with failed forced-march saves and sleep/rest benefits.
7. Change an affected quantity outside Journeys before Go Back. It must refuse without altering any documents. Resolve the conflict and retry. Resolve pending player rolls before using Go Back. Test reload persistence and repeat the forward step: consumption and effects must apply once again, not twice.
8. The Core-runner check below restores the previous step of the prepared disposable journey. Compare the recorded actor/item values from step 6 before and after as well:

   ```js
   const { runJourneyGoBackTests } = await import("./modules/morelord-journeys/scripts/testing/journey-go-back.mjs");
   console.log(JSON.stringify(await runJourneyGoBackTests(), null, 2));
   ```

9. Verify normal/narrow windows, both themes, keyboard operation, and 200% zoom with Core styles loaded. Retain reports/screenshots. Restore the original encounter frequency and delete only fixtures created for this test. Undo does not remove historical chat messages or reverse manually applied benefits, combat, or other modules' changes.
