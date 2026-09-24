# 0.8.13 → 0.9.0-beta.6 feature parity audit

Date: 2026-09-24. This is an audit record, not a release certification.

- Baseline: `v0.8.13` (`7d92c034dd231252dbe2eee3e3968bd19666a462`).
- Audited current source: `a39263ea22c739d62b29b78a596222ff2e7a57fc`; runtime version `0.9.0.6`, display version `0.9.0-beta.6`.
- Scope: manifest entry points, all first-party runtime module changes, settings and stored-data readers, page actions, background coordination, packaging, and existing regression coverage.
- No live salaries, ticket prices, flight plans or user records were changed. Browser integration tests use isolated profiles and local fixtures. Actual game variants remain a validation limit.

## Conclusion

The existing feature families remain present, and the tested ordinary paths work. However, full parity cannot be claimed: one functional regression and one upgrade-display regression were reproduced. A browser timing assertion also failed once and needs better instrumentation; it is not established as a queue defect.

No fix to the shipped runtime is included in this audit. The companion probes describe the observed behavior and are separate from the passing regression suite.

## Findings

### F01 — P2: valid empty schedules cannot be captured

Locations: `extension/modules/read-only.ts:135`, `extension/modules/read-only.ts:168`, `extension/modules/schedule-storage.ts:17`.

Trigger: an airline has no scheduled flights, including a previously operating airline that removes its last route.

The baseline extractor can save `schedule: []`. The current shared parser rejects every zero-route result, and the background save handler independently rejects an empty array. There is no distinction between a confirmed empty timetable and an unreadable response. The old snapshot remains current even when the airline has stopped all services.

The new competitor “save all” flow also waits for schedule collection before saving the overview and facts. An empty schedule therefore prevents those successfully fetched records from being saved. The companion probe reproduces both the baseline empty save and the current rejection, then confirms that the new competitor record was not written.

This additionally prevents a later schedule comparison from representing removal of every flight, although comparison itself is a new feature rather than part of baseline parity.

Suggested repair: recognize a verified empty timetable separately from missing/invalid markup, allow its empty snapshot through the background validator, and keep existing data when the response is unrecognized. Cover normal-empty, all-routes-removed, malformed response, and competitor save-all cases. The actual game's empty-state markup should be inspected before implementing the recognizer; blindly accepting every zero-row parse would weaken the existing protection.

### F02 — P3: saved baseline column labels are not migrated to plain text

Locations: `extension/content_dashboard.ts:1050`, `extension/content_dashboard.ts:2471`, `extension/content_dashboard.ts:394`.

Trigger: upgrade with column settings written by 0.8.13, rather than starting with empty storage.

The baseline stores labels such as `Rating &Delta;` and `PAX load &Delta;`. Current code safely renders labels as text and uses plain `Δ` translation keys. Its migration updates only the FKO label, leaving other saved labels unchanged.

Reproduction loads the actual baseline default-column function into a fixture, then feeds its output into the current Chinese Dashboard. Fifteen competitor column-picker labels still display literal `&Delta;` in English. Six route column labels also remain in the baseline escaped form. Column values are not lost, but headings/options render incorrectly and bypass translation.

Suggested repair: map known legacy labels to current canonical labels by stable column ID, retaining visibility, order and filters. Keep text-based rendering; do not reintroduce HTML interpretation of stored strings. Add upgrade fixtures to localization checks, which currently report zero findings despite this issue.

### V01 — validation gap: queue browser assertion is intermittent

Location: `test/browser/extension.test.cjs:122`.

The full browser run passed 9 of 10 tests. The failed assertion required at least 20 ms between the local HTTPS server receiving an AES price POST and a native price POST. The same test passed on an isolated rerun, then passed three further instrumented runs.

Instrumented results:

| Run | Background permit start gap | Server receipt gap |
| --- | ---: | ---: |
| 1 | 63 ms | 33 ms |
| 2 | 64 ms | 25 ms |
| 3 | 70 ms | 31 ms |

These measure different events: issuing a permit precedes persistence and form submission, while the server timestamp includes browser scheduling and transport. The original failing run did not retain enough timestamps to determine its cause. It must not be presented as a clean full-suite pass, nor as a confirmed failure to serialize submissions.

Suggested follow-up: record permit, actual form-dispatch and server-receipt times; assert dispatch spacing at the intended boundary and retain server observations as diagnostics. Keep the deterministic queue boundary tests.

## Baseline feature coverage

“Covered” means inspected and exercised by the cited test families, not certified against every current game layout.

| Baseline feature | Evidence and result |
| --- | --- |
| Installation/injection, page ownership, menu, popup, About, historical release notes | Manifest URL patterns retained; helpers, modules, build and browser-extension tests cover loading and UI. New build bundles prerequisites and packages compiled scripts. |
| Dashboard General, schedule extraction and salary entry links | Dashboard and read-only tests cover entry points, status and refresh. Empty schedules have F01. |
| Route management, directional frequencies, load/index history | Dashboard and inventory tests cover joins, totals, dates and deltas. Legacy display names have F02. |
| Dashboard filters, sorting, column preferences, selection/hiding and batch opening | Dashboard tests cover identifiers, selection and persistence; Chromium covers ten-page dispatch. Batch limit intentionally increased from six to ten. Timing evidence is qualified by V01. |
| Step-rule pricing and reference recommendations | Direct baseline/current comparison: 1,200 scenarios × four cabins, with zero differences across the checked analysis/recommendation fields. Existing tests cover current/reference separation and bounds. |
| Automatic/manual analysis saving, historical display/preferences | Inventory tests cover snapshots, automatic saving, grouped/classic tables, history, failed writes and native replacement. |
| Automatic/manual price submission and auto-close | Inventory, inventory-close, queue and Chromium tests cover pending journal, confirmation, native/AES submission and document-specific closure. No real-game price submission performed. |
| Salary adjustment in absolute/percentage modes | Settings-page and personnel Chromium tests cover calculation, journaling, repeated batches and server-confirmed form navigation. No real-game salary change performed. |
| Competitor following, owner index, overview/facts, schedule viewing | Enterprise, dashboard, read-only and storage tests cover collection, migration, refresh and preservation. F01 affects empty-schedule save-all; F02 affects upgraded labels. |
| Fleet collection, undelivered registration matching, filters and selection | Fleet/aircraft tests cover preservation and filters; shared storage tests cover independent updates and conflicts. |
| Aircraft/flight financials, profitability summaries, HUB overrides, sequence checks | Fleet/aircraft, modules and read-only tests cover calculations, parsing, overrides and collection. Read-only collection intentionally replaces opening financial-detail tabs. |
| Flight-plan template extraction, offset scheduling, resume/stop and HUB records | Flight-plan and audit regression tests cover template schema 6, service-day/via boundaries, ownership, cancellation, fixed/automatic arrivals and correction. Actual Wicket interaction is mocked, not an end-to-end run against the game. |
| ORS rating differences and remembered reference | Module tests and source comparison; retained behavior with numeric validation. |
| Settings editing and persistence | Settings-page, background, coordinator and browser tests cover defaults, preservation, CAS updates and new tab placement. Baseline pricing settings default to step rules. |
| Backup/export/import, logs, cleanup | Options and browser tests cover export, import, journal recovery and logs. Existing backup envelope retained; pricing backup now additionally includes route-analysis records. |

## Verification performed

- `npm run typecheck`: passed.
- `npm test`: 355 passed, 0 failed.
- `npm run test:browser`: 9 passed, 1 failed; isolated rerun and three diagnostic repeats passed. See V01.
- `npm run test:i18n`: zero static coverage findings; this does not cover F02's legacy stored text.
- Companion baseline comparison/probes: completed, confirming F01/F02 and 1,200-scenario pricing equivalence.

Pricing comparison uses baseline defaults, loads at and around all default step boundaries, capacities 100/123, default prices 37/100/157, current price points 40/60/100/199/220, and current-versus-old active flight prices. It compares capacity/bookings, analysis prices, eligibility, current/reference targets and labels, direction and index across Y/C/F/Cargo. This is a bounded matrix, not proof for arbitrary user configurations.

Run the additional probes from the repository root:

```sh
npm run build
node docs/archive/parity-audit-2026-09-24.repro.cjs
```

The launcher reads `v0.8.13` through Git and requires the existing development dependencies. It uses synthetic pages and in-memory storage, prints the known regression observations, and does not contact AirlineSim. Its zero exit status means the audit probes completed, not that feature parity passed.

Before claiming full parity, fix F01/F02 and verify the actual game empty-state markup, live planner response lifecycle, and representative localized pages. Ordinary tests cannot certify every game server, account configuration, markup variation or browser lifecycle condition.
