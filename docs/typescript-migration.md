# TypeScript migration

## Milestone 1 — build pipeline and shared runtime

Implemented on 2026-09-08 against version 0.8.13. This is the first migration
checkpoint, not completion of the whole extension migration.

### Completed

- Established the original baseline: all 10 tests passed before migration.
- Added TypeScript 7, Chrome types, and jQuery 3 types, locked in package-lock.json.
- Added strict type checking for migrated TypeScript and JS/TS coexistence.
- Added a clean build to `build/extension/`, with unchanged manifest paths and
  content-script loading order. Existing JavaScript and third-party assets are
  copied byte-for-byte, so unmigrated scripts retain their original semantics.
- Changed tests to execute generated JavaScript and packaging to archive the
  complete build directory. Type errors stop the build and clear stale output.
- Added pull-request validation and type checking to the existing release workflow.
- Migrated seven source files:
  - `background.ts`
  - `helpers.ts`
  - `popup.ts`
  - `modules/notification.ts`
  - `modules/notifications.ts`
  - `modules/aes-menu.ts`
  - `modules/about-dialog.ts`
- Added shared contracts for airlines, inventory pricing defaults, notifications,
  menu items, frontend settings, DOM readiness and logging.
- Renamed the custom `Notification` class to `AESNotification`; retained the
  public `Notifications.add` / `newNotification` API and timing behavior.
- Declared AES lifecycle state explicitly and validated external frontend settings
  and saved airline lookup records. Numeric legacy airline IDs normalize to strings.
  Settings keys and serialized pricing defaults remain unchanged.

### Validation

23 tests pass against the generated extension, covering the original UI cases plus
settings compatibility, background message routing, manifest and HTML references,
classic-script syntax, readiness values, date calculations, notification timing,
and overlapping enterprise/schedule scripts in manifest order.

A deliberate invalid notification type was rejected by the build; stale build
output was removed. The probe source was removed afterward. ZIP inspection checks
that manifest.json is at the root and no TypeScript sources or source maps ship.

Chrome/Edge loading on a live AirlineSim account, CI execution on GitHub, and Beta
publication have not been performed. Local test results are not substitutes for
those release checks.

### Development commands

```sh
npm ci
npm run typecheck
npm test
npm run package
```

Load `build/extension/`, not `extension/`, as an unpacked extension. Rebuild and
reload after source changes. The package remains `dist/AES-vX.X.X.zip`, with no
extra directory layer; the package command prints its absolute path last.

`module: preserve` and `moduleDetection: legacy` retain classic scripts. No runtime
imports or exports are introduced in this milestone. `types/models.d.ts` contains
only declarations; it does not inject a runtime namespace. Browser globals remain
shared where required. The background helper functions are scoped to their worker.

## Milestone 2 — independent modules and settings pages

Seven more runtime files are now TypeScript, bringing the total to 14 of 21:

- `options.ts`
- `modules/release-notes.ts`
- `modules/inventory/validation.ts`
- `modules/flightInfo/flightInfo.ts`
- `modules/onlineReservationSystem/onlineReservationSystem.ts`
- `content_settings.ts`
- `content_personnelManagement.ts`

All migrated files pass strict checking without `any` annotations, ignored errors,
or unchecked assertions. `types/independent-modules.d.ts` describes backup exports,
legacy import envelopes, log summaries, release notes, financial records and salary
preferences. Imported storage values remain `unknown` until checked; arbitrary
legacy record fields are retained instead of imposing a new storage schema.

The options page still runs independently of `helpers.js`. Its status timers use a
WeakMap rather than custom properties on DOM elements. Settings and personnel
scripts use private function scopes because their former `settings`, `server` and
`airline` globals conflict with the remaining legacy scripts. Their manifest entry
paths and startup order remain unchanged; no ES modules or bundler were introduced.

### Boundary corrections covered by tests

- Backup restore checks that metadata and data are objects before clearing storage.
  Minimal older metadata remains accepted. A failed clear stops the replacement;
  unreadable files and failed storage operations report errors.
- Log listing tolerates malformed stored records; cleanup retains unknown date
  layouts instead of treating them as empty historical datasets.
- Release-note dismissal and page-ownership loss remove keyboard handlers; footer
  observers disconnect on ownership loss. Footer version lookup uses parsed
  frontend settings rather than assuming page-world globals are accessible.
- Flight extraction rejects invalid IDs, retains the existing storage key/record
  format for valid flights, and displays an em dash for missing financial cells.
- ORS ignores a corrupt persisted maximum rating instead of propagating NaN.
- Settings can render incomplete preferences without persisting fallback values.
  Invalid first/last pricing-step boundaries show feedback rather than reading
  a nonexistent preceding row. Normal setting edits preserve unrelated data.
- Personnel settings normalize older numeric strings, preserve extra fields, and
  retain percentage/absolute salary calculation and submission behavior.

### Validation

49 tests pass against the built extension. Ten new compatibility tests were run
against the original five independent modules before migration; four more were run
against the original settings/personnel scripts. Additional tests exercise the
boundary corrections above. Existing shared-runtime and overlapping-page tests
remain passing. Tests use jsdom and mocked Chrome APIs; no real account data is
changed by them.

Real Chrome/Edge loading, GitHub CI execution and Beta publication remain pending.

## Milestone 3 — enterprise overview and flight schedule

`content_enterpriseOverview.ts` and `content_flightSchedule.ts` are migrated,
bringing the total to 16 of 21 runtime source files. All smaller page modules are
now TypeScript; the five remaining files contain the larger business workflows.

The two enterprise scripts keep private page variables and share one explicitly
typed competitor record through `AES.getCompetitorPageData`. The record is keyed
by server, controlled airline and viewed airline. A delayed second storage read
cannot replace the first script's updated automation flag. The same AES instance
still owns initialization and cleanup; manifest paths and loading order are unchanged.

`types/enterprise.d.ts` describes newly extracted overview/facts records, route
segments, passenger/cargo frequencies and schedule snapshots. Historical records
remain checked at their read boundaries and retain unknown fields. Owner-scoped
and legacy storage keys remain compatible; extracting from a legacy competitor
record writes the owner-scoped record and keeps the legacy record intact.

### Validation and behavior corrections

66 tests pass against the built extension. Six compatibility tests were first run
against the original JavaScript, covering overview/index updates, facts extraction,
same-week suppression, route splitting/frequencies, legacy automation and settings
flag updates. Additional tests cover callback ordering, failed reads and writes,
retry behavior, ownership loss and malformed historical containers.

The migration also corrects concrete issues exposed by those tests:

- Failed competitor/schedule history writes no longer navigate to the next tab.
  Failed writes keep the action available for retry; failed tracking writes restore
  the checkbox and do not change the tracking index.
- Starting all-tab extraction from a non-overview tab persists its flag before
  navigating. A failed automation-completion write retains the flag for retry.
- Empty or wholly unparseable schedule tables do not overwrite stored snapshots.
  Numeric flight number zero remains supported, matching the old parser.
- The schedule-history label uses the actual latest schedule date, and malformed
  history entries are ignored for display without deleting those entries.
- Pending reads stop when this AES instance loses page ownership.

Local validation still uses jsdom and mocked Chrome storage/navigation APIs. Live
Chrome/Edge testing, GitHub CI execution and Beta publication remain pending.

## Milestone 4 — fleet management and aircraft flights

`content_fleetManagement.ts` and `content_aircraftFlights.ts` are migrated,
bringing the total to 18 of 21 runtime source files. Both retain classic-script
entry paths and use private page scopes. `types/aircraft.d.ts` defines fleet
identities, page-only DOM rows, stored profit summaries, flight sequence issues,
HUB matching and tab-opening progress. No ignored diagnostics, explicit `any`,
or unchecked assertions were introduced.

Legacy numeric/string aircraft IDs, registration-only undelivered aircraft,
nullable HUB fields and unknown aircraft metadata remain supported. Current-fleet
replacement still removes missing aircraft only from the fleet being viewed.
Stored financial values are checked before use; malformed values are omitted
from the profit count rather than added as strings or rendered as invalid money.

### Validation and behavior corrections

80 tests pass against the generated extension. Four compatibility tests ran on
the original JavaScript before migration. The fourteen fleet/aircraft tests now
cover fleet merging, empty fleets, filters/selection, profit aggregation, HUB
precedence/save/reset, sequence continuity and year rollover, malformed links and
storage values, storage errors, delayed reads, ownership loss, extraction progress,
and footer column reconciliation after native table updates.

- Aircraft startup reads financial and fleet records before writing its summary.
  It no longer launches overlapping preliminary zero-profit writes. Failed reads
  preserve the previous saved summary.
- Failed fleet/HUB writes stop dependent updates and do not display success.
- Pending storage callbacks and table refreshes stop after ownership loss; flight
  extraction stops opening additional tabs and suppresses fallback opening when
  this instance loses ownership.
- Missing or malformed flight IDs are skipped instead of dereferencing a failed
  regular-expression match.

Type checking, tests and local packaging are verified. Tests use jsdom and mocked
Chrome APIs; live browser checks, GitHub CI execution and Beta publication remain
pending. Cross-tab storage transactions are not introduced by this migration.

## Milestone 5 — aircraft flight planning

`content_aircraftFlightPlan.ts` is migrated, bringing the total to 19 of 21
runtime source files. The flight-plan assistant retains its classic-script entry,
storage keys and template schema version 6. Private page state and the contracts
in `types/flight-plan.d.ts` describe visual service-day entries, via-segment arrival
times, templates, scheduling states and planner controls without ignored diagnostics,
explicit `any` or unchecked assertions.

### Validation and behavior corrections

97 tests pass against the generated extension. Six baseline tests ran against the
original JavaScript before migration. Seventeen flight-plan tests now cover:

- Via flights spanning Sunday midnight, service-day grouping and HUB tie breaking.
- Sunday-to-Monday scheduling offsets, selector loading, persistence before form
  submission and confirmation after reloading a scheduled plan.
- Old template replacement, jobs on other aircraft, corrupt current-version
  records, failed storage operations and duplicate start clicks.
- Stopping a job while planner updates are pending and losing ownership during
  initialization or scheduling.

Storage wrappers now reject read/write/remove failures. Template and new-job state
are published to the page only after successful persistence. Failed status writes
stop before form submission, and failed completion cleanup cannot report success.
Stopping a job invalidates its running coroutine so pending waits cannot continue
clicking controls or submitting forms. Starting is guarded against duplicate clicks.

Templates and jobs are checked at the storage boundary, including entry/service-day
structure and job indexes/status. Corrupt current-version templates and invalid jobs
remain stored for recovery. Invalid jobs cannot auto-resume; the existing Stop
scheduling action can explicitly clear them. Old template schema versions retain
the existing removal/re-extraction behavior. Valid records retain extra metadata.

Tests run in jsdom with mocked Chrome APIs and intercepted form submissions. No
real AirlineSim schedule was submitted. Real-browser testing, GitHub CI execution
and Beta publication remain pending. This batch does not introduce cross-tab
transaction locking or redesign the existing arrival-time scheduling algorithm.

## Milestone 6 — inventory pricing

`content_inventory.ts` is migrated, bringing the total to 20 of 21 runtime source
files. Only the dashboard remains JavaScript. `types/inventory.d.ts` describes
flight/cabin rows, prices and input controls, analysis results, snapshots and
pending price updates. The classic-script entry and existing route-analysis keys
remain unchanged. The module uses a private scope and strict checking without
explicit `any`, ignored diagnostics or unchecked type assertions.

### Validation and behavior corrections

114 tests pass against the generated extension. Five compatibility tests ran
against the original JavaScript before migration. Seventeen inventory tests now
cover current-price and reference-only recommendations, boundary correction,
grouped cabin rows, snapshot saving, pending-price confirmation, automation,
history compatibility, storage failures and page changes during persistence.

- Airline/server initialization precedes analysis instead of running in a separate
  jQuery-ready callback that could complete after inventory extraction starts.
- Snapshot persistence writes serializable data without analysis methods. Failed
  saves keep the action retryable and do not close the page or submit prices.
- Pending price updates are persisted before submission and confirmed only when
  current page prices match all recorded targets. Saving a snapshot retains an
  outstanding pending marker; failed confirmation suppresses automatic retries.
- Rendering checks page ownership and a revision/signature containing native
  table/input identity and content. Same-row-count replacements refresh analysis;
  old asynchronous actions cannot submit after ownership loss or a native change.
- Stored snapshots are read through typed views. Malformed dates/records are
  ignored for display and preserved in storage. Partial cabin histories render
  missing data without inventing usable analysis.
- Missing price rows, incomplete flights, invalid configuration and invalid edited
  target prices stop the relevant action. Zero minimum price remains accepted,
  matching the settings editor. Configuration validation does not rewrite settings.

Tests use jsdom, mocked Chrome APIs and intercepted pricing-form submissions; no
real AirlineSim prices were changed. Real-browser testing, GitHub CI execution and
Beta publication remain pending. This batch does not add cross-tab storage locking
or redesign the recommendation formulas.

## Milestone 7 — dashboard and local finalization

All 21 first-party runtime files are now TypeScript. `content_dashboard.ts` uses
private scope and `types/dashboard.d.ts` contracts for settings, columns, filters,
schedules, analysis and competitor history. Manifest entries remain classic
JavaScript scripts emitted by the compiler; vendored jQuery remains unchanged.

130 tests pass against the generated extension, including 16 dashboard tests.
Four dashboard compatibility tests passed against the original JavaScript before
migration. Coverage includes route totals and inventory links, profitability
averages, selection and removal, competitor schedules, filters and preferences,
legacy migration, storage failures and stale callbacks.

- Switching airline scope reliably clears scoped filters; column preferences
  survive settings normalization and table regeneration.
- Storage failures prevent success callbacks and dependent deletion. Legacy
  competitor migration saves replacement records before deleting originals.
- Typed display views tolerate partial history without rewriting raw records.
  Targeted removals preserve unrelated metadata and unrecognized fleet records.
- View revisions and ownership checks reject stale rendering callbacks. Missing
  native schedule links cannot enable automatic extraction.

The compiler accepts only TypeScript source. The build rejects
first-party JavaScript and removes stale build output before validation. Generated
JavaScript is written only to `build/extension`; the source directory retains
TypeScript and static assets, including vendored jQuery. Build tests check source coverage for
runtime entries, classic-script output, asset references and unchanged vendor JS.

## Final validation status

| Original stage | Status | Remaining validation |
| --- | --- | --- |
| 1. Behavior baseline | Complete locally | Compare migrated flows in the real browser |
| 2. Build pipeline | Complete locally | Run the new workflow on GitHub |
| 3. Shared contracts | Complete locally | Monitor compatibility with live stored records |
| 4. Independent modules | Complete locally | Real-browser validation |
| 5. Core business | Complete locally | Real-browser validation |
| 6. Finalization | Complete locally | GitHub CI and Beta validation/publication |

Load `build/extension` as the unpacked extension and use it for packaging.
The source directory `extension/` is not directly loadable. After TypeScript edits, run
`npm run build` and reload the extension. Before Beta publication, verify popup/options and migrated page flows
in a real browser, including dashboard tab changes, saved filters, extraction,
pricing confirmation and scheduling stop/resume. Review actual data-changing
operations separately during that validation. Local tests use jsdom and mocked
Chrome APIs; no actual AirlineSim schedule or price was changed.

This migration does not change the storage schema version, bundle scripts or
convert runtime entries to ES modules. Cross-tab storage transaction locking and
business algorithm redesign remain outside its scope. Changes are not published
or released by the local migration checks.

## Current loading workflow

The final choice is to load `build/extension`. The temporary direct-source-loading
behavior has been removed, including its 21 generated source-directory scripts.
Builds never publish JavaScript beside TypeScript sources. Build tests reject first-party JavaScript in `extension/`. Run `npm run build` after source edits and reload the extension.
