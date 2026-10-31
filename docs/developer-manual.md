# AES Developer Manual

[Project overview](../README.md) · [Documentation index](README.md) · [User manual](user-manual.md) · [Developer manual](developer-manual.md)

Build, test and extend AES. Run the commands below from the repository root.

## Local development

```sh
npm ci
npm run typecheck
npm test
npm run package
```

Load `build/extension` as the unpacked extension in Chrome or Edge. Run
`npm run build` after editing TypeScript, then reload the extension and the
AirlineSim page. The `extension/` directory contains TypeScript sources and static
assets; generated JavaScript is written only to `build/extension`. Vendored jQuery
remains JavaScript (jQuery 4.0.0 full build). Packaging uses the same source-free build directory.

`npm test` builds first and tests the generated JavaScript. `npm run package`
builds before creating `dist/AES-vX.X.X.zip`, whose root contains `manifest.json`.
See the [TypeScript migration history](archive/typescript-migration.md) for the completed migration checkpoints.

## Releases

Release automation is documented in [the release automation guide](development/release-automation.md).

## Notifications

AES comes with its own notification API. This uses AS’ notification style and location. The AES notification API consists of two components: `Notifications` and `AESNotification`.

### Usage

Notifications should only be used as a response to an action by the user; don’t add notifications on a page load.

### Initiate the `Notifications`:

To start using the notification API create a new `Notifications`:

```
const notifications = new Notifications()
```

### Add a new notification

To add a notification:

```
notifications.add("The settings have been updated")
```

By default, a new notification comes with the success styling (a checkmark icon and a green background). The style can be changed by passing an option object:

```
notifications.add("Failed to save data", {type: "warning"})
```

The possible values for `type` are:

- `"success"`
- `"warning"`
- `"error"`

## Browser smoke test

After installing dependencies, run `npx playwright install chromium` once, then
`npm run test:browser`. This loads the generated extension in an isolated Chromium
profile, checks its service worker, storage backup, options opening, dashboard
injection and paced batch navigation/price submissions. Test hostnames resolve to
a local HTTPS fixture server, including tabs opened by the extension. The test
requires OpenSSL to create a temporary certificate and removes its profile after
completion; live-game acceptance still requires separate validation.

## Shared page queue

AES batch navigation, read-only collection, Inventory price submissions and salary
POSTs share one session-persistent FIFO across tabs. Dashboard batches accept up to
10 selections. Operations wait for the preceding response or target page load,
then leave a randomized 55–65 ms gap. Browser scheduling and message/storage
latency can lengthen the interval. Loading state survives worker restarts; missed
load events are recovered from the target tab state. A stuck load or expired
request receives a further one-minute recovery pause without replaying it.

HTTP 429, server 5xx responses and recognized Unexpected Error / Too Many Requests
error pages pause the shared queue for at least one minute. Repeated errors within
ten minutes double the pause, up to fifteen minutes. A longer Retry-After value
(seconds or an HTTP date) takes precedence, bounded to one day. Cooldown state is
stored in browser session storage, so cancellation, a different tab or a worker
restart cannot clear it. Waiting clients check in at least once a minute while
awake, including during long cooldowns, to keep their waiting lease alive.

Chrome's explicit tab-strip drag rejection leaves an open/navigation job at the
head of the queue. Retry delays increase from 100 ms to at most 1 second; another
drag rejection after 30 seconds ends the job. A delayed client first checks
whether Chrome has recovered. Other errors and unknown outcomes are not retried.
Pending price submissions are cancelled if the page or inputs change while waiting.

This paces operations routed through the AES queue, including native Inventory form
submissions intercepted on initialized pages. It does not intercept unrelated
manual browser navigation, planner AJAX, game resource requests, or requests from a
separate installed AES copy. The server's actual rate limits are not published or
verified; these safeguards cannot guarantee that the server never rejects a request.

Salary adjustments POST the game's form fields (including the submitter), once per
affected form, using current-page fetch. Each response body is consumed and checked
for server errors before releasing the queue slot or dispatching the next form.
Responses cannot navigate away and interrupt the remaining positions. The first
transport, HTTP or recognized error-page failure stops the remaining salary batch.
AES does not read wages back or retry writes; game salary limits remain the
server's responsibility. The recorded update time represents an adjustment attempt,
not verified persistence. Legacy pending journals no longer resume submissions and
are removed by the next adjustment.

## Localization checks

`npm test` checks the nine locale catalogs and runs `scripts/audit-i18n.cjs` against
all built first-party scripts plus options/popup markup. `npm run test:i18n` runs
the text coverage audit alone. It checks prose in metadata, variables, templates,
errors and markup, and rejects literal text at common UI sinks. It is a static
coverage check, not a proof that every dynamic value is translated: runtime tests
also exercise fleet summaries, pricing advice, filters, settings and collection
progress across languages.

Use `AESI18n.t` for authored text, with placeholders for values, or `AESI18n.html`
for AES-authored markup. Keep stored identifiers and processing phases independent
of translated labels. Do not translate airline names, airport codes, editable
pricing-rule names or other user/game data. Reviewed non-UI strings and product
names are documented in `scripts/i18n-exemptions.json`; historical release-note
bodies keep their original language. Backend errors are translated at their UI
boundary, while unknown browser/service diagnostic details retain their source.


## Further references

- [Localization guide](development/localization.md): language detection, catalogs and translation conventions.
- [Pricing data example](examples/pricing-data.js): illustrative stored pricing data, not a schema definition.
- [Chrome Web Store listing](store/chrome-web-store-listing.md): store description copy.
- [Historical records](README.md#historical-records): earlier audits, implementation reports and validation results.

## Startup diagnostics

An independent content script loads before jQuery and helpers. It reports startup
failures with a localized, dismissible banner and reload/copy actions. Its small
translation catalog is bundled separately so helper parsing failures cannot hide
the notice. A final startup check detects missing helpers or storage interfaces.

Diagnostics contain extension/browser versions, the module, error code/message,
page origin/path and component availability. URL queries and fragments are
removed; no business records or cookies are read. Copying requires a user click,
and clipboard failure reveals a selectable read-only field. Nothing is sent
automatically. A dismissed notice stays dismissed for that page load.
