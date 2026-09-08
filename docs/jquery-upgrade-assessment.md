# jQuery 4.0 upgrade assessment

Assessment date: 2026-09-08. Assessed baseline: vendored jQuery 3.7.1 Slim.
The sections below record the pre-upgrade investigation. The user subsequently
approved **4.0.0 full**, superseding the initial Slim recommendation. The current
runtime is now vendored `jquery-4.0.0.min.js`, with `@types/jquery` 4.0.1.

The full build retains the three dashboard delay/queue handlers. Added regression
tests verify their empty-selection messages, eventual label restoration and
unchanged storage; aircraft actions also verify that no tab opens. Chromium checks
assert runtime version 4.0.0 and availability of delay. The old vendor asset was
removed and all runtime/test references updated. No permissions, storage schema,
extension version or publication settings were changed. Live-game acceptance and
publication remain separate from these local checks.

## Evidence

The [official download page](https://jquery.com/download/) lists 4.0.0 as the latest
stable release. The [4.0 upgrade guide](https://jquery.com/upgrade-guide/4.0/)
documents removal of callbacks, deferred and queue modules from Slim, removed
utility APIs, and changes to CSS, data and selectors. The
[release announcement](https://blog.jquery.com/2026/01/17/jquery-4-0-0/) describes
Trusted Types support and modernization. These are upstream capabilities, not a
claim that this extension currently has an exploitable vulnerability.

Experiments used a temporary copy of extension sources, tests and build scripts.
Official CDN 4.0.0 Slim/full bytes replaced the vendor file only in that copy.
The existing 3.7.1 filename was retained in that temporary copy to isolate runtime
compatibility from reference changes. Actual upgrading must rename the file and
update its references. Browser checks used an isolated Chromium profile and local
page fixtures, with no game-account access. Tests ran without jQuery Migrate.

| Experiment | 4.0.0 Slim | 4.0.0 full |
| --- | --- | --- |
| Existing regression suite | 130 passed | 130 passed |
| Chromium extension smoke test | Passed | Passed |
| Three added empty-selection click probes | 3 failed | 3 passed |

The three probes trigger the actual dashboard handlers for Open aircraft, Remove
aircraft and Remove airline with no checked rows. Slim throws `delay is not a
function` in each case. Existing tests therefore did not cover these paths.
The probes assert that handlers do not throw; they do not yet verify delayed label
restoration or repeated-click timing.

A separate type-check probe with registry package `@types/jquery@4.0.1` passed
against the current TypeScript sources. This demonstrates type compatibility,
not Slim API availability: the declarations also describe full-build APIs.

## Concrete compatibility work

- `extension/content_dashboard.ts:829`, `:864`, `:2518`: replace the three
  `.delay(900).queue(...)` chains with a shared native timer helper. Define
  repeated-click behavior, cancel superseded timers and avoid updating detached
  controls after a tab switch or ownership loss. Preserve button text and timing.
- Add regressions for all three empty-selection actions, restoration after 900 ms,
  repeated clicks, view changes and ownership loss.
- Replace the vendored asset and rename its references in `extension/manifest.json`,
  `extension/options.html`, `test/build.test.js`, `test/helpers.test.js` and
  `test/support/browser.cjs`. Keep a single jQuery copy per extension context.
- Update `@types/jquery` and the lockfile, then rerun type checking, regression
  tests, Chromium smoke tests and package verification.

Static searches found no direct uses of the removed jQuery utility methods or
explicit Deferred/Callbacks/when calls. The existing `toggleClass('active', bool)`
uses a retained signature. No `.css(...)` calls were found in runtime TypeScript.
DOM selection, manipulation and event behavior still merit live-page validation;
passing fixtures cannot establish compatibility with every AirlineSim page.
The test harness evaluates the browser script in jsdom rather than calling
`require('jquery')(window)`, so the changed Node factory import is not applicable.

## Options and cost

| Choice | Minified bytes | Locally gzipped bytes | Assessment |
| --- | ---: | ---: | --- |
| Current 3.7.1 Slim | 70,264 | 24,036 | Keep until upgrade is verified |
| 4.0.0 Slim | 56,032 | 19,424 | Recommended after three message fixes |
| 4.0.0 full | 78,748 | 27,519 | Passes current probes, but retains modules otherwise unnecessary here |

Sizes are measured from downloaded files, not browser performance benchmarks.
The Slim candidate is about 20% smaller in minified bytes. Its benefit is modest
for a locally bundled extension; no performance improvement has been measured.
The known code changes are bounded and do not require a DOM-layer rewrite or a
storage-schema migration. Residual risk is concentrated in untested interactions
and live page differences, so describe the upgrade as moderate risk before the
additional checks, not as a drop-in update guaranteed by the current suite.

Suggested sequence: add missing regressions on 3.7.1; replace timer chains;
update runtime and declarations; run the full checks; validate dashboard empty
selections, preferences, backup/restore, extraction, pricing and scheduling in a
controlled browser session before release. Migrate 4 can assist development-time
diagnostics as recommended upstream; do not make it a permanent runtime dependency.
Retain the old vendor file and reference changes in version history for rollback.
