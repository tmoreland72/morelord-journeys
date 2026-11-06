# Morelord Journeys 0.6.1

The Foraging outcome and the Expedition Log report the same food result. Camp lists watches and does not show a rest count before rest is resolved.

## What Changed

### Fixes

- The **Foraging outcome** and the Expedition Log use one sentence for food found on the day's foraging checks. `Found 4 food: 3 to pool, 1 excess to foragers` means four rations were found, three supply travelers today, and one surplus ration was added to a forager's inventory. **to pool** appears only when that amount is greater than zero. **excess to foragers** appears only when surplus food was stored. The sentence then says how many rations and how many pints of water are still required. A success still finds one ration, which is that traveler's meal. A total of 20 or a natural 20 still finds one extra ration. Each extra ration still covers a traveler who failed before any remainder is stored. Any success still finds water for the party, and carried water is not consumed. Those amounts are unchanged. The outcome and the log report that split instead of counting a separate inventory receipt.
- The Expedition Log lists Camp as its watch assignments. It includes a rest-result count only when that Camp entry recorded rest. Sleep & Shelter lists the rest-result count after rest is resolved. Continuing from Camp before rest no longer shows zero rest results beside the watches.

## Verification

`npm test` and `npm run check` passed all 163 tests with Morelord Core 0.9.1 checked out beside this repository. That includes the shared foraging sentence when food goes to the pool, when only surplus is stored, and when nothing was found, plus Camp logged before rest (`4 watches`) and Sleep on the same day (`3 rest results`).

A single successful forager is reported as `Found 1 food: 1 to pool`, with water found for the party and no surplus ration stored. A total of 20 or a natural 20 for that forager is `Found 2 food: 1 to pool, 1 excess to foragers`. A failed forager is `Found 0 food`, with one ration and four pints of water still required. No second food or water grant was added or removed.

No in-Foundry testing was run. There is no Foundry world in this environment, so Dev1 checks were not executed. Foundry's latest stable release is 14.370 (2 November 2026). This change was not verified in Foundry, so `compatibility.verified` stays 14.369. Minimum 14 and maximum 14 are unchanged. `module.json` stays at 0.6.0. The Release workflow resolves 0.6.1 from a patch bump. No stored identifiers or campaign data were migrated or deleted. The Release workflow was not dispatched.
