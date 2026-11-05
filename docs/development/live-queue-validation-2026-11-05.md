# Live page queue validation — 2026-11-05

This supplements the local queue tests for commit `0d0f05c`.

## Environment and procedure

- Signed-in Chrome session on the real Paradise AirlineSim server.
- Installed AES reports `0.9.0-beta.14`; ASX was also present.
- Used Aircraft Profitability → Open aircraft (max 10), which opens aircraft
  flight-list pages (`/app/fleets/aircraft/<id>/1`).
- Ran three batches during approximately 08:23–08:25 Asia/Shanghai: 6, 10, and
  10 delivered aircraft pages (26 opens total). The first selection included
  undelivered aircraft, which AES correctly skipped.
- Checked batch feedback, every opened page's aircraft heading, and captured
  browser console errors. Also checked the final batch's visible text for
  Too Many Requests, Unexpected Error, HTTP 429, and rate-limit messages.
- Closed the 26 test-created aircraft tabs and restored the dashboard's original
  General selection afterward.

## Observations

All three batches reported completion and all 26 pages displayed the expected
normal aircraft headings. No rate-limit error page or rate-limit console message
was observed. The two ten-page batches spanned 4.231 and 10.738 seconds between
first and last tab creation, respectively, according to browser tab metadata.
These are tab-creation spans, not HTTP response times or throughput benchmarks.

The repeat batch initially exceeded the browser tool's short selector-wait
window, then completed normally; it was not an AES queue timeout. Some pages
reported an ASX null-link parsing error. The dashboard also had message-channel
closure errors without an attributable extension stack. Neither observation is
evidence of server rate limiting; both are retained here rather than describing
this run as having no console errors.

## Scope and limits

The live run checks ordinary authenticated page opening. It does not test live
price or salary mutations, find the server's rate-limit threshold, or establish
that sustained five-way concurrency is safe on every server. No raw HTTP status
or Retry-After trace was collected, and worker permit state was not directly
inspected. Internal enforcement of five shared slots, same-tab serialization,
FIFO dispatch, restart recovery, and 429/5xx cooldown remains covered by the
local deterministic and installed-extension fixture tests.

The supported conclusion is: **these 26 real page opens completed without an
observed rate-limit failure**. A universal “five concurrent operations never
trigger rate limiting” conclusion is not supported.
