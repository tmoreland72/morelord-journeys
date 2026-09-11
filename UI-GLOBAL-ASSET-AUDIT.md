# Journeys global UI and step-page audit

September 11, 2026. **Downtime is the visual reference.** This replaces the earlier audit’s incorrect recommendation to remove top-level section surfaces.

## Shared contract applied

Journeys now uses Downtime’s existing Core section anatomy: `ml-surface ml-stack`, `ml-section-heading`, and Core spacing. Journey identity, party, route ratings, supplies, current phase, and log have consistent section treatment. The supply manifest is a sibling of the party section rather than another box inside it. Supply totals use the same `ml-card ml-stack` / `ml-eyebrow` composition as Downtime’s GM summary.

Core owns the window-content padding reset, heading margins, and stack text margins. This removes both Foundry’s extra outer padding and browser heading/paragraph margins that competed with component gaps. Journeys’ local heading typography, checkbox overrides, section dividers, and forced role-grid spacing were removed. Traveler selection retains `ml-choice-card`; its portrait rule now targets the actual renderer class.

## Step-page findings and changes

| Page | Inconsistency found | Applied shared treatment |
| --- | --- | --- |
| Weather | Plain wrapper allowed controls to touch; independent margins on result strips caused uneven gaps. | `ml-stack` for the whole workflow, `ml-cluster` for roll/toggle controls, `ml-audit-card` for results, shared heading and toggle. Measured gaps between visible workflow children are 12px. |
| Pace | Different surrounding heading/spacing from other phases. | Same phase surface and heading; native select inherits Core field styling. |
| Day Encounters | Injected card duplicated phase padding and accent borders; result summary added another set of margins. | Shared stack within the phase, shared outcome details and integration callout; remove duplicate wrapper appearance. |
| Discovery | Lead, observer request, and time cost had separate arbitrary margins and unstructured wrappers. | Shared stacks for workflow/lead/request; retain `ml-field-group` for time cost and the existing details/data-list components. Remove extra time-cost top margin. |
| Navigation | A second bordered request panel and custom two/three-column action grids. | Shared request stack, status, outcome details, and wrapping control cluster. |
| Press On | Controls were forced onto one line; pending request rows could become too wide. | Shared toggle and stack; wrapping control layout and narrow request-row fallback. |
| Foraging & Supplies | Independent panel/card padding, several custom gap scales, boxed allocation subsections, bespoke exception disclosure. | Shared stack, card rows, actions, audit summaries, and `ml-details` / `ml-details__body`. Preserve allocation controls and inventory behavior. |
| Camp / Night Encounters | Camp was boxed inside the phase; watch rows, periods, and coverage each had different padding. | Shared stack, cards, summary cards, and danger callout. Local CSS retains the four-period schedule and watch indicator. Night encounter controls remain in Camp because that is the existing workflow. |
| Sleep & Shelter | Different row gaps, result styles, typography fallback, and local card backgrounds. | Shared stack/card/audit components and spacing tokens; keep shelter controls and sleep calculations local. Long character/DC headings wrap. |
| Day Complete | Same phase wrapper but no common heading/action placement contract. | Shared phase surface and heading, consistent trailing action placement. |

All phase controls keep their existing input names, actions, and state. Continue remains a direct child of the phase because render extensions use it as an insertion anchor. Party insertion now targets the route-ratings section explicitly. No journey data, roll resolution, or inventory semantics were intentionally changed.

## Verification

A local headless Chromium fixture renders the actual Handlebars template and the complete `JourneyForagingApplication` render-extension chain against mock Foundry data. It loads the installed Foundry CSS and the current Core/Journeys styles. The Downtime reference uses its actual dashboard template and the same Core styles.

- Planner and ten phase/completion views checked at 1180, 700, and 590px viewport widths: 33 rendered cases.
- Every phase uses 16px surface padding; no horizontal app overflow in these fixtures.
- Weather has five successive 12px workflow gaps at each width.
- No browser runtime errors in these cases; party remains outside the route-identity section.
- Journeys’ existing 89 tests and Core’s 26 tests pass; changed JavaScript passes syntax checks.
- Core’s default design-system check passes for all four feature targets. The explicit Downtime check reports two pre-existing issues in untouched files: its chat template is classified as an application, and Training Selection has an icon button without an aria-label.
- The old namespace migration tool is absent from the current Core working tree; the current design-system checker enforces its namespace boundary instead.

This is browser verification with mock data, not a live multiplayer Foundry session. Saved-world combinations, player dialogs, both themes, and actual 200% browser zoom still need live acceptance. The 590px fixture is a narrow-layout check, not a claim of zoom testing.

## Remaining global opportunities

### Character identity follow-up

Character names now use Core's `actorIdentity` renderer and shared `ml-actor-identity` / `ml-avatar` styles throughout Journeys' role summaries, watch assignments and coverage, forced-march requests/results, sleep requests/results, food recipients and allocation sources, supply consequences, and detailed roll outcomes. Existing traveler cards retain their portraits; forager rows use the shared identity component. Player request dialogs also include the identity and shared window token scope. Native character selectors retain text options and show the selected avatar alongside the field, without repeating the name below it. Exclusive-role changes refresh both portraits.

The global brand guide now records this rule, and Core's boundary check protects the identity components from feature-owned redefinitions. Missing actors fall back to saved identity information or a neutral portrait; names and image attributes are HTML-escaped. Plain-text system titles and accessibility labels remain text.

Avatar verification: 54 browser cases across three widths, including pending/resolved navigation, forced march, foraging, and sleep states. Checks also exercise automatic role reassignment and portrait synchronization. No fixture overflow or browser errors; all 89 Journeys tests and 28 Core tests pass, including escaping and deleted-actor fallback checks. These are mock-data browser fixtures, not live-world acceptance.

The earlier audit also identified Journeys-owned help/player dialogs that omit Core’s shell, the custom sticky settings footer, and some remaining local text/read-only field treatments. These are separate follow-ups from the dashboard and step-page consistency changes. Existing shared documentation, access cards, progress, outcome details, and integration callouts should continue to be reused.

Do not substitute “passes the design-system checker” for visual consistency: the checker does not detect nested section misuse or local selectors that duplicate a global component’s appearance.

## Zero-DC and portrait follow-up

Zero-DC role, foraging, forced-march, hunger, sleep, and sleep-deprivation checks resolve as normal successes without a player roll request. Sleep still requires enough uninterrupted hours for a Long Rest; automatic foraging grants ordinary success food. Outcomes distinguish DC 0 from GM overrides. Supply Manifest sources and items use body-size names and shared card rows, and actor portraits use circular crops.

Validation: 97 Journeys tests and 28 Core tests passed, including eight zero-DC service regressions. The 60 mock browser cases at 1180px, 700px, and 590px passed with no horizontal overflow; rendered portraits were circular and supply names were at least 16px. The shared design-system boundary check passed. This does not replace live multiplayer acceptance.
