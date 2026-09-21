# Night settings and supply continuation regression

Follow Core's `IN-GAME-TESTING.md` in a disposable development world. Do not reset Demo1. In Journeys Settings, confirm Encounter Dice shows the Danger mapping and a night frequency selector. Save hourly, reopen, and verify persistence; repeat with per-watch checks. The old die and d100 modifier fields must be absent.
2. Follow `danger-dice-undo-regression.md` for encounter and Go Back scenarios.
3. Prepare a disposable journey in Foraging with all checks resolved, tracked rations/water available, and supplies not yet consumed. Record the starting item quantities. Run:

   ```js
   const { runJourneySettingsSuppliesTests } = await import("./modules/morelord-journeys/scripts/testing/journey-settings-supplies.mjs");
   console.log(JSON.stringify(await runJourneySettingsSuppliesTests(), null, 2));
   ```

   **This check clicks Continue and consumes fixture supplies.** Confirm that inventory reductions match the saved allocation quantities, and that the journey advanced with one click. Reopening must not deduct supplies again. Repeat a separate fixture with a rapid double-click.
4. Repeat with scarce food: select recipients before continuing and check that the choice is respected. Repeat with manual food/water and manual exception outcomes; outside supplies must not be deducted from tracked inventory.
5. Repeat with a food shortage requiring a save. Continue consumes available supplies once and stays on Foraging with the save pending. Resolve it as the player or GM fallback, then Continue must advance without consuming again. Also check already-consumed saved journeys and pending foraging requests.

Retain the Core runner report and screenshots. Delete only disposable fixtures created for these checks.
