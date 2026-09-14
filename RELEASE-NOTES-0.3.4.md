# Morelord Journeys 0.3.4

## What Changed

### Improvements

- Days 1�4 without food request a daily Constitution save (default DC 10); failure adds one Exhaustion. Day 5 and each subsequent day without food automatically add one Exhaustion without a roll. Constitution does not alter this threshold. Send Save / GM Roll resends a pending request to the player or opens it for the GM when the player is offline, including after disconnecting. The daily DC remains configurable; the old hunger DC increase is no longer used.

- Settings use Core headers, section headings, cards, responsive settings rows, badges, and footers; duplicated local settings styling has been removed.

- Journey Settings uses Core’s separate, opaque page footer so Save Changes stays visible while settings scroll.

- Daily Route Ratings now appears below Ready for the Road on journey days.

- Daytime encounters use the configured die (default d6) once per traveler per Danger check/day. Players trigger their requests; only GMs see dice and outcomes. Ones add encounters and maximum rolls cancel them across the party, with a minimum of zero. Route Traffic is removed. Daily Route Ratings can be changed before each travel day, carry forward, and are recorded in that day’s log. Active journey pages and Journey Settings use Core’s described, remembered collapsible sections. Traveler selection uses Core’s player-owned-or-party character eligibility.

- Journey Steps now collapses and remembers its last state per user and world in the current browser. It starts expanded; collapsing preserves step selections.

- Create Journey now uses the standard button appearance and hover state instead of starting with a solid orange background.

- Removed Journey Name and Route Name inputs. New labels derive from origin and destination while existing stored names remain compatible.
- All creation sections are collapsible and described; Journey Distance is followed by Route Ratings.
- Party cards use compact Core selection controls. Supply cards group items by character or shared inventory with aligned name and quantity columns.

- Hide Optional Exploration Activities until every party foraging check is resolved and no requests remain pending.

### Changed

- Require Morelord Core 0.3.7 or later for the shared components and character eligibility used by this release.

## Validation

- All 104 module tests pass; Core's design-system check passes across six feature modules.
- Live Foundry visual and multiplayer verification was not performed.
