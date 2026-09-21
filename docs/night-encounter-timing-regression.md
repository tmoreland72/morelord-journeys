# Night encounter timing regression

Use a disposable development journey, not Demo1's prepared state. Follow Core's `IN-GAME-TESTING.md`. These checks are pending live verification.

1. Enter Camp, assign watches, and use **Roll Night Encounter** until a night encounter occurs (use subsequent disposable nights for another roll). Before resolving Perception, verify that a notice above the planner names the selected watch and its hours since camp began. Watch 1 is 0–2 hours; Watch 4 is 6–8 hours. The notice should appear before the request opens.
2. On the recipient client, verify the Perception prompt gives the same watch and hours. Resolve the check normally. Verify the GM's encounter chat roll includes those hours when dice/chat display is enabled and retains GM-only visibility.
3. Run this on the GM client, then close/reopen or reload Camp and run it again:

   ```js
   const { runNightEncounterTimingTests } = await import("./modules/morelord-journeys/scripts/testing/night-encounter-timing.mjs");
   console.log(JSON.stringify(await runNightEncounterTimingTests(), null, 2));
   ```

4. Repeat with all periods explicitly unwatched. An encounter must still show its timing and explain that no Perception check is requested. Repeat with Skip Dice Animation enabled: the Camp notice must remain visible without a chat roll.
5. Check a night with no surviving encounters: it should report zero encounters without an affected-watch notice. Legacy Peaceful Rest results remain readable. Check the notice and request at normal/minimum window widths, both themes, and 200% zoom with Core styles loaded; text should wrap without covering controls. Retain reports and screenshots.

The automated check reads saved state and renders/closes its own window. It does not roll dice, alter assignments, send requests, or change character data; rendering may initialize undo history. Request delivery, ordering, chat visibility, and visual checks above remain manual.
