# Chrome Web Store Listing

## Name

AirlineSim Enhancement Suite

## Short Description

Dashboard, pricing, schedule, fleet, and monitoring tools for AirlineSim.

## Detailed Description

AirlineSim Enhancement Suite adds practical management tools to AirlineSim:

- Route Management dashboard with schedule and analysis columns
- Competitor Monitoring with per-airline competitor lists, filters, facts and figures, and schedule views
- Aircraft Profitability dashboard with filters, configurable columns, and averaged summary values
- Inventory pricing helpers with historical comparison
- Fleet Management data extraction
- Personnel Management reminders
- ORS score display
- Local backup and restore for AES data

AES stores its data locally in the browser. It does not transmit gameplay data to the developer or to third parties.

## Category

Productivity

## Language

English

## Website

https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite

## Support URL

https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues

## Privacy Policy URL

https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/blob/next/PRIVACY.md

## Permissions Justification

### `storage`

Required to save AES settings and locally extracted AirlineSim gameplay data, including schedules, pricing history, fleet data, competitor monitoring data, and aircraft profitability data.

### `unlimitedStorage`

Required because local schedule, inventory history, competitor monitoring, and aircraft flight history can exceed the default extension storage quota for active AirlineSim users.

### `declarativeContent`

Required to show the extension action only on AirlineSim pages.

### Host permission: `https://*.airlinesim.aero/`

Required so AES can run content scripts on AirlineSim game pages and enhance the pages selected in the manifest.

## Single Purpose Statement

AES improves AirlineSim gameplay and management workflows by adding local browser-side tools to AirlineSim pages.

## Data Usage Disclosure

AES does not collect or transmit user data. It stores extension settings and extracted gameplay data locally in Chrome extension storage. The user can export or import this local data manually through the options page.

Recommended Chrome Web Store privacy answers:

- Does the extension collect or use user data? No, data is not collected by the developer.
- Is data sold to third parties? No.
- Is data used or transferred for purposes unrelated to the item's single purpose? No.
- Is data used or transferred to determine creditworthiness or for lending purposes? No.

## Suggested Screenshots

- Dashboard: Route Management with Actions, Filters, and Columns
- Dashboard: Competitor Monitoring with filters and actions toolbar
- Dashboard: Aircraft Profitability with averaged summary row
- Inventory pricing history comparison
- Options page backup and restore

## Release Notes for 0.7.5

- Refactored Dashboard tables and controls across Route Management, Competitor Monitoring, and Aircraft Profitability.
- Added per-airline Competitor Monitoring filters and moved competitor actions into the toolbar.
- Improved filtering, column toggles, aircraft profitability averages, and Dashboard runtime resilience.
- Fixed Manifest V3 compliance issues and bundled extension page styles locally.
