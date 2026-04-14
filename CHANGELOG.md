# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.7] - 2026-04-13

### Changed

- Refined Dashboard loading, filtering, and schedule table behavior so each tab restores more cleanly and large datasets feel steadier while data loads.
- Improved the Flights page HUB override controls layout so the AES tools sit more naturally within the native aircraft Flights page.

### Fixed

- Fixed Dashboard tab initialization, filter normalization, and competitor schedule rendering issues that could leave tabs blank or throw runtime errors until filters were reapplied.
- Fixed Dashboard sorting, zero-value rendering, and Aircraft Profitability row actions so formatted numbers sort correctly, valid `0` values remain visible, and undelivered aircraft can still be managed safely.
- Fixed Fleet Management filtering and native selection link integration so `all / none / invert` works with AES filters, action availability stays in sync with checkbox state, and native table refreshes no longer break AES-added columns.

## [0.7.6] - 2026-04-12

### Added

- Added richer Fleet Management extraction for delivery status, ownership, pilot assignment, seat configuration, and schedule state.
- Added automatic aircraft HUB detection from the Flights page, plus HUB override controls and Fleet Management HUB filtering.
- Added new Aircraft Profitability columns for delivery status, ownership, pilot assignment, seat totals, pure cargo status, seat configuration, schedule state, and HUB.

### Changed

- Refined the aircraft Flights page tools so the AES controls sit more naturally inside the original page layout and use notifications for status feedback.
- Updated Fleet Management terminology from `Equipment` to `Model`, added a HUB column, and aligned new table headers with the native fleet table styling.
- Renamed Aircraft Profitability schedule labels to `Active`, `Locked`, `Conflict`, and `Empty`, with matching status colors.

### Fixed

- Fixed Fleet Management extraction on live pages where aircraft links use relative paths, restoring aircraft ID capture and downstream fleet persistence.
- Fixed Fleet Management and Dashboard handling for undelivered aircraft so they can be stored by registration before an aircraft ID exists and still display the correct `Delivered` status.
- Fixed HUB synchronization so data extracted on the Flights page is available in Fleet Management and Aircraft Profitability.
- Fixed the Flights page notifications so they auto-dismiss again after a short delay.
- Fixed Fleet and Flights table presentation issues, including undelivered aircraft profit/date alignment, header centering, and missing border artifacts.

## [0.7.5] - 2026-04-10

### Added

- Added Dashboard filters for Competitor Monitoring, including substring matching for text fields.
- Added additional Competitor Monitoring facts and figures extraction for operated flights, seats offered, seat kilometer offered, units offered, and freight kilometer offered.
- Added local release and Chrome Web Store preparation materials, including a packaging script, privacy policy, and store listing draft.

### Changed

- Refactored Dashboard tables to share one rendering and control architecture across Route Management, Competitor Monitoring, and Aircraft Profitability.
- Moved Competitor Monitoring row actions into the shared Dashboard action toolbar and aligned Dashboard action button order across Route Management and Aircraft Profitability.
- Improved Dashboard filtering and aggregate behavior so filters, column toggles, and Aircraft Profitability averages stay in sync with the visible table state.

### Removed

- Removed an unused extension permission to reduce Chrome Web Store review scope.

### Fixed

- Fixed Dashboard column chooser panels so Competitor Monitoring and Aircraft Profitability stay open while multiple columns are toggled.
- Fixed Competitor Monitoring controls so the filter panel also appears when no competitors are currently tracked.
- Improved Dashboard Competitor Monitoring loading by indexing tracked competitors per controlled airline and loading only their schedule data.
- Fixed Fleet Management so updating aircraft data no longer creates a phantom aircraft entry when the default fleet is empty. [#29](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/29)
- Fixed reported Inventory and Dashboard runtime errors caused by missing page elements or unavailable storage references. [#4](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/4) [#5](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/5) [#6](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/6)
- Fixed Aircraft Profitability age aggregation so age is averaged in the summary row instead of summed. [#9](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/9)
- Fixed source archive hygiene so development-only repository files are excluded from generated archives.
- Fixed Manifest V3 compliance issues by removing remote stylesheets from extension pages and replacing deprecated `ShowPageAction` usage.
- Fixed Competitor Monitoring so each controlled airline has its own competitor list instead of sharing one server-wide list.
- Fixed old data cleanup so storage dates in `YYYYMMDD` format are parsed correctly and recent history is not removed by mistake.
- Fixed settings initialization so existing users receive newly added default settings after an update.
- Fixed airline detection to avoid storing data under an empty airline key when the current page lacks expected airline details.
- Fixed notifications initialization so pages without the expected navbar container no longer fail when creating the notification panel.

## [0.7.4] - 2026-03-06

### Fixed

- Fixed an issue that might cause price boundaries to be inactive when the price is beyond the set maximum or below the set minimum.

## [0.7.3] - 2025-11-01

### Changed

- The formula used to calculate load indices is reworked. [#27](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/27)

### Fixed

- History data comparison on Inventory pages:
  - "Now" data can now correctly compare to the data from the latest analysis date.
  - The latest analysis date can now correctly display its comparison versus the earlier date.
  - Percentage changes can now display with the correct sign. [#28](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/28)
  - Columns can now match correctly when having "Show 'now' column" ticked.
- Internal: Minor spelling mistakes

## [0.7.2] - 2025-08-21

### Added
- ORS scores are now displayed as numbers. Thanks [Baymax2009](https://github.com/Baymax2909) for the contribution. [#26](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/pull/26)

### Fixed
- Configuration backup can now be created with the correct extension version.

### Removed
- Internal: Obsolete test modules

## [0.7.1] - 2025-06-21

### Added
- Import/export functionality of options. Thanks [malshoff](https://github.com/malshoff) for the contribution. [#23](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/pull/23)

### Changed
- Internal: Flight extraction function splitted from main code. Thanks [Baymax2009](https://github.com/Baymax2909) for the contribution. [#24](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/pull/24)
- A-B-C stopover flights will no longer be counted into flight frequency of A-C.

### Fixed
- Flights with stopover will only be parsed as separate legs. [#14](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/14)
- Stopover flights and "active in future" pax flights will no longer be considered as cargo flights.
- Flight info will be correctly extracted on free game worlds. [#13](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/13)

## [0.7.0] - 2025-05-24

### Fixed
- Open new tabs for route management can now correctly open 6 tabs. 

### Changed
- Personnel management: All salary adjustments can now be correctly saved with only one refresh.

## [0.7.0d] - 2025-05-10

### Changed
- Empty aircraft categories are now hidden without breaking layout. [#8](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/8)
- Updated the dropdown menu.[#7](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/7)
- Rev for minor versions can now be displayed on the Chrome extension management page. [#12](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/12)

## [0.7.0c] - 2025-05-10

### Changed
- An interval for page opening has been added for extracting flight data. [#3](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/3)

### Fixed
- Undelivered aircraft now have their age parsed as 0. [#10](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/10)

## [0.7.0b] - 2025-05-05

### Changed
- Internal: getAirline() function reworked.
- Internal: Data structure of Competitor Monitoring reworked.

### Fixed
- Competitor monitoring can now correctly fetch schedules and display the info of schedules on the dashboard. [#2](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/2)
- Internal: Various Misspellings corrected. 
- Internal: Airline Info can be correctly stored under fleet management and personnel management page.

## [0.7.0a] - 2025-05-04

### Changed
- Redesigned the data storage structure. Now, airline data is stored based on airline ID, which prevents issues of mixed information from airlines with the same name or code. However, it requires switching to the corresponding airline from the switch tab before using the tool for each airline.
- Internal: Enhanced code reusability.

### Fixed
- Personnel salary update date can now be correctly displayed. [#97](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/97)
- Internal: Many misspellings corrected.

## [0.6.9] - 2025-05-04

### Added
- Added a double dash to indicate “no data” in the “Flights”-table in the aircraft’s “Flights” tab [#65](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/65)
- Added the "Select first 6" function to the aircraft profitability page on the dashboard.

### Changed
- Set the maximum number of concurrently opened tabs to 6 to address the server’s ‘Too Many Requests’ limitation.
- Rearranged the order of the buttons for the aircraft profitability page on the dashboard.

### Fixed
- Fixed an issue where an error was thrown when trying to get flight data [#65](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/65)
- Fixed a visual issue with “Flights”-table when viewing aircraft flights [#65](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/65)
- In historical data of inventory, the past dates are now correctly determined. [#93](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/93)
- Conflict with XTH tools on salary adjustment resolved.
- Button text beautification
- Internal: Fixed the definition of three variables in the Route Management function.
- Internal: Two misspellings fixed.
- Internal: Integer parsing function reworked.

## [0.6.8] - 2024-06-09

### Added
- Added `AES.getDate()` helper function [#26](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/26)
- Format large numbers according to your localisation settings [#11](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/11)
- Improved legibility of status text in dark mode [#13](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/13)
- Added a menu with helpful links related to AES [#32](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/pull/32)
- Added an about screen with some basic info related to AES [#33](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/33)
- Added code validation in places as to prevent future UI changes breaking data
- Added CSS to hide empty aircraft manufacturing categories

### Changed
- Updated the AUTHORS file [#21](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/21)
- Ported some parts from jQuery to vanilla JavaScript
- Changed AES table styling to take up less horizontal space in some cases [#14](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/14)
- Changed the inventory page styling to make it easier to read [#25](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/pull/25)

### Fixed
- Fixed an issue where inventory pages wouldn’t close automatically [#17](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/17)
- Fixed an issue where the route management schedule couldn’t be updated [#16](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/16)
- Fixed an issue where no new data was written from the inventory pages [#25](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/pull/25)

### Removed
- Removed duplicate helper functions [#28](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/28)

## [0.6.7] - 2024-05-05

### Added
- All currency values are now formatted according to the user’s localisation settings (ie. 3,000 AS$ / 3.000 AS$)
- Added a .editorconfig-file

### Fixed
- Fixed an issue where schedule extraction was shown as "NaN days ago" on the dashboard

## [0.6.6] - 2024-05-04

### Fixed
- Fixed an issue where the wrong UI element was queried for the server date

## [0.6.4] - 2020-07-01

_Last public release by Marcipanas_

### Added
- Aircraft Profitability - you can browse your fleet and see its profit
    - profit column is also added to Fleet Management page
    - each aircraft page has a summary of its profits

## 0.6.2 - 2020-06-24

### Fixed
- Personnel Management module will no longer get stuck in a loop when trying to set an amount higher/lower than is allowed by AirlineSim backend.
- Inventory Pricing module will not load if incorrect inventory settings are selected and will display error message for wrong settings. Required to load Inventory Pricing module:
    - All Flight Numbers tab selected
    - Apply settings to airport pair checked
    - Apply settings to flight numbers checked
    - Apply settings to return airport pair unchecked
    - Apply settings to return flight numbers unchecked
    - Service classes all checked
    - Flight status inflight and finished checked
    - Load minimum to 0% and max to 100%Flight status inflight and finished checked
    - Group by flight unchecked
- Inventory Pricing module history table would go out of the page bounds if there are many dates, now the table remains within the page with horizontal scroll bar.
- Inventory Pricing module history table now shows the most recent 5 or 10 dates if the option is selected instead of the oldest.

## 0.6.1 - 2020-06-22

### Added
- Competitor Monitoring - allows tracking other airlines

## 0.5.4 - 2020-05-13

### Fixed
- Personnel Management - clicking apply salary no longer fires any excess employees.

## 0.5.3 - 2020-05-12

### Added
- Personnel Management Module - allows to quickly change salary of your employees.

### Changed
- Route Management Dashboard - select first 50 changed to select first 10.
- Route Management Dashboard - open inventory button changes to max 10.
- Route Management Dashboard - added inventory button next to each row to open inventory page.
- General Dashboard - displays info on last personnel salary change date.

### Fixed
- Inventory Pricing and Analysis not working with German language (thanks to @derMaster1
for pointing it out).

## 0.5.2 - 2020-05-09

_First release._

[unreleased]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.7.7...HEAD
[0.7.7]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.7.6...v0.7.7
[0.7.6]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.7.5...v0.7.6
[0.7.5]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.7.4...v0.7.5
[0.7.4]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.7.0d...v0.7.0
[0.7.0d]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.7.0c...v0.7.0d
[0.7.0c]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.7.0b...v0.7.0c
[0.7.0b]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.7.0a...v0.7.0b
[0.7.0a]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.6.9...v0.7.0a
[0.6.9]: https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/compare/v0.6.8...v0.6.9
[0.6.8]: https://github.com/ZoeBijl/airlinesim-enhancement-suite/compare/v0.6.7...v0.6.8
[0.6.7]: https://github.com/ZoeBijl/airlinesim-enhancement-suite/compare/v0.6.6...v0.6.7
[0.6.6]: https://github.com/ZoeBijl/airlinesim-enhancement-suite/compare/v0.6.5...v0.6.6
[0.6.5]: https://github.com/ZoeBijl/airlinesim-enhancement-suite/compare/v0.6.4...v0.6.5
[0.6.4]: https://github.com/ZoeBijl/airlinesim-enhancement-suite/releases/tag/v0.6.4
