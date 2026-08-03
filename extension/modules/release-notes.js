const AES_RELEASE_NOTES_STORAGE_KEY = "aesReleaseNotesSeenVersion"
const AES_RELEASE_NOTES = {
    "0.8.9": {
        title: "Release Notes",
        releaseDate: "2026-08-03",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Fixed",
                items: [
                    "Fixed Competitor Monitoring on the Dashboard so saved competitors load for the selected controlled airline and missing or stale competitor indexes are rebuilt automatically."
                ]
            }
        ]
    },
    "0.8.8": {
        title: "Release Notes",
        releaseDate: "2026-07-26",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Changed",
                items: [
                    "AES server dates now use frontendSettings.server.time as their sole UTC source, independent of the Footer time display preference.",
                    "Aircraft Flights HUB detection now prefers each aircraft's complete Flight Plan rotation, while retaining Flights history as a fallback and preserving manual overrides.",
                    "Release Notes can now browse earlier AES versions one page at a time with Previous and Next navigation."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Fixed Flight Plan Assistant schedule shifting for flights with intermediate stops, including later segments that depart after midnight.",
                    "Fixed missing Flights table border segments when AES and another extension both insert columns."
                ]
            }
        ]
    },
    "0.8.7": {
        title: "Release Notes",
        releaseDate: "2026-07-08",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Changed",
                items: [
                    "Aircraft Flights controls and messages now use extract terminology, keep the extraction buttons right-aligned, and show the sequence check inside the main summary table above the data save time."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Fixed Fleet Management so empty fleet placeholder rows are no longer saved as aircraft.",
                    "Old blank fleet placeholder records are cleaned up while undelivered aircraft with registrations remain preserved."
                ]
            }
        ]
    },
    "0.8.6": {
        title: "Release Notes",
        releaseDate: "2026-06-20",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Changed",
                items: [
                    "Refreshed the Import/Export page with a consistent AES panel style, improved data summary cards, unified status messages, and responsive layout."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Fixed Aircraft Flights download controls so the flight data buttons stay visible, show progress, and can be used again after a download run finishes.",
                    "Improved bulk flight data downloads by opening flight information tabs through the extension background worker and reporting blocked or failed tab opens instead of failing silently."
                ]
            }
        ]
    },
    "0.8.5": {
        title: "Release Notes",
        releaseDate: "2026-06-13",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Added",
                items: [
                    "Added an Aircraft Flights sequence check that reports invalid aircraft rotations, ignores cancelled flights, and highlights rows involved in sequence issues."
                ]
            },
            {
                title: "Changed",
                items: [
                    "Improved Personnel Management controls with clearer salary inputs, native AES notifications, disabled apply actions while updates are running, and visible last-update status.",
                    "AES notifications now fade out before being removed."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Fixed content scripts that could initialize before their target page elements existed on asynchronously rendered AirlineSim pages.",
                    "Fixed Personnel Management salary updates so AES can find salary tables across multi-row header layouts, fall back to the native salary form column when needed, and stop automatic retries after failures.",
                    "Fixed Aircraft Flights HUB override handling so entered airport codes are normalized to three characters."
                ]
            }
        ]
    },
    "0.8.4": {
        title: "Release Notes",
        releaseDate: "2026-06-07",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Added",
                items: [
                    "Added in-page AES error notifications for content scripts that fail while inserting or updating AirlineSim pages, so affected modules now report visible errors instead of failing silently.",
                    "Added daily AES diagnostic logs and Options-page log file management for downloading or clearing per-day logs."
                ]
            },
            {
                title: "Changed",
                items: [
                    "Improved Dashboard table selection actions so hiding checked rows and reading selected rows avoid scanning every visible row on large tables."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Fixed Flight Plan Assistant so the selected offset day remains selected after automated scheduling completes.",
                    "Fixed server date detection to avoid fragile footer selectors and improve compatibility with updated AirlineSim footer layouts.",
                    "Fixed server date detection when AirlineSim renders an empty footer first by falling back to frontendSettings.server.time.",
                    "Fixed Aircraft Flights initialization so malformed non-flight rows no longer prevent the AES Aircraft Flights panel from rendering."
                ]
            }
        ]
    },
    "0.8.3": {
        title: "Release Notes",
        releaseDate: "2026-05-21",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Fixed",
                items: [
                    "Fixed Route Management Dashboard loading for upgraded users whose saved Dashboard settings were missing column definitions, which could show Unable to load route management data even after schedule extraction.",
                    "Hardened Route Management settings migration, reload, column saving, filter saving, and route analysis rendering so incomplete stored data no longer breaks the main table."
                ]
            }
        ]
    },
    "0.8.2": {
        title: "Release Notes",
        releaseDate: "2026-05-20",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Changed",
                items: [
                    "Inventory Pricing now treats recommendation boundaries as hard limits, so prices below the minimum or above the maximum are adjusted even when current-price flight results are not available yet."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Fixed Route Management Dashboard reload so it re-reads stored schedule data and fails with a visible message instead of leaving the table area blank when stored data is incomplete."
                ]
            }
        ]
    },
    "0.8.1": {
        title: "Release Notes",
        releaseDate: "2026-05-20",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Fixed",
                items: [
                    "Fixed Aircraft Profitability on the Dashboard so invalid or mismatched fleet storage no longer leaves the tab stuck on loading. Issue #32.",
                    "Hardened Dashboard initialization, Route Management, and Competitor Monitoring against incomplete stored data so tabs fail gracefully instead of staying in a loading state.",
                    "Hardened Flights and Fleet Management storage merging so malformed saved flight records no longer interrupt aircraft profit and HUB summaries.",
                    "Fixed Personnel Management salary adjustment for older settings data that did not include salary preferences, which could leave the control stuck on adjusting."
                ]
            }
        ]
    },
    "0.8.0": {
        title: "Release Notes",
        releaseDate: "2026-05-18",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Added",
                items: [
                    "Added the Flight Plan Assistant for individual aircraft Flight Plan pages, including template extraction, saved-template deletion, compact 1-6 offset-day controls, assisted 7-plane-7-day scheduling from existing flight numbers, and timing extraction for short or overnight visual plan blocks.",
                    "Added page ownership arbitration so newer AES versions can take priority when multiple AES builds are enabled on the same AirlineSim page."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Fixed Personnel Management salary adjustment so negative values and immediate apply actions use the current form value reliably.",
                    "Fixed Personnel Management salary updates so AES updates the visible salary inputs first, then submits through the native page controls without getting stuck at adjusting.",
                    "Fixed Personnel Management salary detection so it remains compatible with pages modified by ASX or similar tools that may affect column layout.",
                    "Fixed Inventory Pricing so AES does not inject validation messages into AirlineSim's own error pages when an Inventory request unexpectedly returns an error view.",
                    "Fixed the AES footer version link placement for AirlineSim's updated footer structure, including alignment next to the game version and preventing AES clicks from also opening AirlineSim release notes."
                ]
            }
        ]
    },
    "0.7.8": {
        title: "Release Notes",
        releaseDate: "2026-04-18",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Added",
                items: [
                    "Release notes now open automatically after an update and can be reopened from the footer version link.",
                    "Grouped inventory tables are now supported, and reference recommendations can be enabled explicitly for routes whose current price has no flight results yet."
                ]
            },
            {
                title: "Changed",
                items: [
                    "The release notes dialog now adapts to dark, classic, and light AirlineSim themes and shows the release date next to the AES version.",
                    "Inventory Pricing now separates executable recommendations from optional reference recommendations, and recommendation prices are shown inline."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Inventory Pricing settings now persist reliably across pages instead of being overwritten by stale settings snapshots.",
                    "Inventory analysis now reloads automatically after toggling Group by flight, and grouped-mode fallback analysis no longer shows invalid zero prices."
                ]
            }
        ]
    },
    "0.7.7": {
        title: "Release Notes",
        releaseDate: "2026-04-13",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Changed",
                items: [
                    "Dashboard loading, filtering, and schedule table behavior were refined so each tab restores more cleanly and large datasets feel steadier while data loads.",
                    "The Flights page HUB override controls now sit more naturally within the native aircraft Flights page."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Dashboard tab initialization, filter normalization, and competitor schedule rendering issues that could leave tabs blank or throw runtime errors were fixed.",
                    "Dashboard sorting, zero-value rendering, and Aircraft Profitability row actions were corrected so formatted numbers sort correctly and undelivered aircraft can still be managed safely.",
                    "Fleet Management filtering and native selection link integration were fixed so all / none / invert works with AES filters and native table refreshes no longer break AES-added columns."
                ]
            }
        ]
    }
}

// Historical entries are kept in the same display format as current release notes.
Object.assign(AES_RELEASE_NOTES, {
    "0.7.6": {
        "title": "Release Notes",
        "releaseDate": "2026-04-12",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Added",
                "items": [
                    "Added richer Fleet Management extraction for delivery status, ownership, pilot assignment, seat configuration, and schedule state.",
                    "Added automatic aircraft HUB detection from the Flights page, plus HUB override controls and Fleet Management HUB filtering.",
                    "Added new Aircraft Profitability columns for delivery status, ownership, pilot assignment, seat totals, pure cargo status, seat configuration, schedule state, and HUB."
                ]
            },
            {
                "title": "Changed",
                "items": [
                    "Refined the aircraft Flights page tools so the AES controls sit more naturally inside the original page layout and use notifications for status feedback.",
                    "Updated Fleet Management terminology from Equipment to Model, added a HUB column, and aligned new table headers with the native fleet table styling.",
                    "Renamed Aircraft Profitability schedule labels to Active, Locked, Conflict, and Empty, with matching status colors."
                ]
            },
            {
                "title": "Fixed",
                "items": [
                    "Fixed Fleet Management extraction on live pages where aircraft links use relative paths, restoring aircraft ID capture and downstream fleet persistence.",
                    "Fixed Fleet Management and Dashboard handling for undelivered aircraft so they can be stored by registration before an aircraft ID exists and still display the correct Delivered status.",
                    "Fixed HUB synchronization so data extracted on the Flights page is available in Fleet Management and Aircraft Profitability.",
                    "Fixed the Flights page notifications so they auto-dismiss again after a short delay.",
                    "Fixed Fleet and Flights table presentation issues, including undelivered aircraft profit/date alignment, header centering, and missing border artifacts."
                ]
            }
        ]
    },
    "0.7.5": {
        "title": "Release Notes",
        "releaseDate": "2026-04-10",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Added",
                "items": [
                    "Added Dashboard filters for Competitor Monitoring, including substring matching for text fields.",
                    "Added additional Competitor Monitoring facts and figures extraction for operated flights, seats offered, seat kilometer offered, units offered, and freight kilometer offered.",
                    "Added local release and Chrome Web Store preparation materials, including a packaging script, privacy policy, and store listing draft."
                ]
            },
            {
                "title": "Changed",
                "items": [
                    "Refactored Dashboard tables to share one rendering and control architecture across Route Management, Competitor Monitoring, and Aircraft Profitability.",
                    "Moved Competitor Monitoring row actions into the shared Dashboard action toolbar and aligned Dashboard action button order across Route Management and Aircraft Profitability.",
                    "Improved Dashboard filtering and aggregate behavior so filters, column toggles, and Aircraft Profitability averages stay in sync with the visible table state."
                ]
            },
            {
                "title": "Removed",
                "items": [
                    "Removed an unused extension permission to reduce Chrome Web Store review scope."
                ]
            },
            {
                "title": "Fixed",
                "items": [
                    "Fixed Dashboard column chooser panels so Competitor Monitoring and Aircraft Profitability stay open while multiple columns are toggled.",
                    "Fixed Competitor Monitoring controls so the filter panel also appears when no competitors are currently tracked.",
                    "Improved Dashboard Competitor Monitoring loading by indexing tracked competitors per controlled airline and loading only their schedule data.",
                    "Fixed Fleet Management so updating aircraft data no longer creates a phantom aircraft entry when the default fleet is empty. #29",
                    "Fixed reported Inventory and Dashboard runtime errors caused by missing page elements or unavailable storage references. #4 #5 #6",
                    "Fixed Aircraft Profitability age aggregation so age is averaged in the summary row instead of summed. #9",
                    "Fixed source archive hygiene so development-only repository files are excluded from generated archives.",
                    "Fixed Manifest V3 compliance issues by removing remote stylesheets from extension pages and replacing deprecated ShowPageAction usage.",
                    "Fixed Competitor Monitoring so each controlled airline has its own competitor list instead of sharing one server-wide list.",
                    "Fixed old data cleanup so storage dates in YYYYMMDD format are parsed correctly and recent history is not removed by mistake.",
                    "Fixed settings initialization so existing users receive newly added default settings after an update.",
                    "Fixed airline detection to avoid storing data under an empty airline key when the current page lacks expected airline details.",
                    "Fixed notifications initialization so pages without the expected navbar container no longer fail when creating the notification panel."
                ]
            }
        ]
    },
    "0.7.4": {
        "title": "Release Notes",
        "releaseDate": "2026-03-06",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Fixed",
                "items": [
                    "Fixed an issue that might cause price boundaries to be inactive when the price is beyond the set maximum or below the set minimum."
                ]
            }
        ]
    },
    "0.7.3": {
        "title": "Release Notes",
        "releaseDate": "2025-11-01",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Changed",
                "items": [
                    "The formula used to calculate load indices is reworked. #27"
                ]
            },
            {
                "title": "Fixed",
                "items": [
                    "History data comparison on Inventory pages:",
                    "\"Now\" data can now correctly compare to the data from the latest analysis date.",
                    "The latest analysis date can now correctly display its comparison versus the earlier date.",
                    "Percentage changes can now display with the correct sign. #28",
                    "Columns can now match correctly when having \"Show 'now' column\" ticked.",
                    "Internal: Minor spelling mistakes"
                ]
            }
        ]
    },
    "0.7.2": {
        "title": "Release Notes",
        "releaseDate": "2025-08-21",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Added",
                "items": [
                    "ORS scores are now displayed as numbers. Thanks Baymax2009 for the contribution. #26"
                ]
            },
            {
                "title": "Fixed",
                "items": [
                    "Configuration backup can now be created with the correct extension version."
                ]
            },
            {
                "title": "Removed",
                "items": [
                    "Internal: Obsolete test modules"
                ]
            }
        ]
    },
    "0.7.1": {
        "title": "Release Notes",
        "releaseDate": "2025-06-21",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Added",
                "items": [
                    "Import/export functionality of options. Thanks malshoff for the contribution. #23"
                ]
            },
            {
                "title": "Changed",
                "items": [
                    "Internal: Flight extraction function splitted from main code. Thanks Baymax2009 for the contribution. #24",
                    "A-B-C stopover flights will no longer be counted into flight frequency of A-C."
                ]
            },
            {
                "title": "Fixed",
                "items": [
                    "Flights with stopover will only be parsed as separate legs. #14",
                    "Stopover flights and \"active in future\" pax flights will no longer be considered as cargo flights.",
                    "Flight info will be correctly extracted on free game worlds. #13"
                ]
            }
        ]
    },
    "0.7.0": {
        "title": "Release Notes",
        "releaseDate": "2025-05-24",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Fixed",
                "items": [
                    "Open new tabs for route management can now correctly open 6 tabs."
                ]
            },
            {
                "title": "Changed",
                "items": [
                    "Personnel management: All salary adjustments can now be correctly saved with only one refresh."
                ]
            }
        ]
    },
    "0.7.0d": {
        "title": "Release Notes",
        "releaseDate": "2025-05-10",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Changed",
                "items": [
                    "Empty aircraft categories are now hidden without breaking layout. #8",
                    "Updated the dropdown menu.#7",
                    "Rev for minor versions can now be displayed on the Chrome extension management page. #12"
                ]
            }
        ]
    },
    "0.7.0c": {
        "title": "Release Notes",
        "releaseDate": "2025-05-10",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Changed",
                "items": [
                    "An interval for page opening has been added for extracting flight data. #3"
                ]
            },
            {
                "title": "Fixed",
                "items": [
                    "Undelivered aircraft now have their age parsed as 0. #10"
                ]
            }
        ]
    },
    "0.7.0b": {
        "title": "Release Notes",
        "releaseDate": "2025-05-05",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Changed",
                "items": [
                    "Internal: getAirline() function reworked.",
                    "Internal: Data structure of Competitor Monitoring reworked."
                ]
            },
            {
                "title": "Fixed",
                "items": [
                    "Competitor monitoring can now correctly fetch schedules and display the info of schedules on the dashboard. #2",
                    "Internal: Various Misspellings corrected.",
                    "Internal: Airline Info can be correctly stored under fleet management and personnel management page."
                ]
            }
        ]
    },
    "0.7.0a": {
        "title": "Release Notes",
        "releaseDate": "2025-05-04",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Changed",
                "items": [
                    "Redesigned the data storage structure. Now, airline data is stored based on airline ID, which prevents issues of mixed information from airlines with the same name or code. However, it requires switching to the corresponding airline from the switch tab before using the tool for each airline.",
                    "Internal: Enhanced code reusability."
                ]
            },
            {
                "title": "Fixed",
                "items": [
                    "Personnel salary update date can now be correctly displayed. #97",
                    "Internal: Many misspellings corrected."
                ]
            }
        ]
    },
    "0.6.9": {
        "title": "Release Notes",
        "releaseDate": "2025-05-04",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Added",
                "items": [
                    "Added a double dash to indicate “no data” in the “Flights”-table in the aircraft’s “Flights” tab #65",
                    "Added the \"Select first 6\" function to the aircraft profitability page on the dashboard."
                ]
            },
            {
                "title": "Changed",
                "items": [
                    "Set the maximum number of concurrently opened tabs to 6 to address the server’s ‘Too Many Requests’ limitation.",
                    "Rearranged the order of the buttons for the aircraft profitability page on the dashboard."
                ]
            },
            {
                "title": "Fixed",
                "items": [
                    "Fixed an issue where an error was thrown when trying to get flight data #65",
                    "Fixed a visual issue with “Flights”-table when viewing aircraft flights #65",
                    "In historical data of inventory, the past dates are now correctly determined. #93",
                    "Conflict with XTH tools on salary adjustment resolved.",
                    "Button text beautification",
                    "Internal: Fixed the definition of three variables in the Route Management function.",
                    "Internal: Two misspellings fixed.",
                    "Internal: Integer parsing function reworked."
                ]
            }
        ]
    },
    "0.6.8": {
        "title": "Release Notes",
        "releaseDate": "2024-06-09",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Added",
                "items": [
                    "Added AES.getDate() helper function #26",
                    "Format large numbers according to your localisation settings #11",
                    "Improved legibility of status text in dark mode #13",
                    "Added a menu with helpful links related to AES #32",
                    "Added an about screen with some basic info related to AES #33",
                    "Added code validation in places as to prevent future UI changes breaking data",
                    "Added CSS to hide empty aircraft manufacturing categories"
                ]
            },
            {
                "title": "Changed",
                "items": [
                    "Updated the AUTHORS file #21",
                    "Ported some parts from jQuery to vanilla JavaScript",
                    "Changed AES table styling to take up less horizontal space in some cases #14",
                    "Changed the inventory page styling to make it easier to read #25"
                ]
            },
            {
                "title": "Fixed",
                "items": [
                    "Fixed an issue where inventory pages wouldn’t close automatically #17",
                    "Fixed an issue where the route management schedule couldn’t be updated #16",
                    "Fixed an issue where no new data was written from the inventory pages #25"
                ]
            },
            {
                "title": "Removed",
                "items": [
                    "Removed duplicate helper functions #28"
                ]
            }
        ]
    },
    "0.6.7": {
        "title": "Release Notes",
        "releaseDate": "2024-05-05",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Added",
                "items": [
                    "All currency values are now formatted according to the user’s localisation settings (ie. 3,000 AS$ / 3.000 AS$)",
                    "Added a .editorconfig-file"
                ]
            },
            {
                "title": "Fixed",
                "items": [
                    "Fixed an issue where schedule extraction was shown as \"NaN days ago\" on the dashboard"
                ]
            }
        ]
    },
    "0.6.6": {
        "title": "Release Notes",
        "releaseDate": "2024-05-04",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Fixed",
                "items": [
                    "Fixed an issue where the wrong UI element was queried for the server date"
                ]
            }
        ]
    },
    "0.6.4": {
        "title": "Release Notes",
        "releaseDate": "2020-07-01",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Added",
                "items": [
                    "Aircraft Profitability - you can browse your fleet and see its profit",
                    "profit column is also added to Fleet Management page",
                    "each aircraft page has a summary of its profits"
                ]
            }
        ]
    },
    "0.6.2": {
        "title": "Release Notes",
        "releaseDate": "2020-06-24",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Fixed",
                "items": [
                    "Personnel Management module will no longer get stuck in a loop when trying to set an amount higher/lower than is allowed by AirlineSim backend.",
                    "Inventory Pricing module will not load if incorrect inventory settings are selected and will display error message for wrong settings. Required to load Inventory Pricing module:",
                    "All Flight Numbers tab selected",
                    "Apply settings to airport pair checked",
                    "Apply settings to flight numbers checked",
                    "Apply settings to return airport pair unchecked",
                    "Apply settings to return flight numbers unchecked",
                    "Service classes all checked",
                    "Flight status inflight and finished checked",
                    "Load minimum to 0% and max to 100%Flight status inflight and finished checked",
                    "Group by flight unchecked",
                    "Inventory Pricing module history table would go out of the page bounds if there are many dates, now the table remains within the page with horizontal scroll bar.",
                    "Inventory Pricing module history table now shows the most recent 5 or 10 dates if the option is selected instead of the oldest."
                ]
            }
        ]
    },
    "0.6.1": {
        "title": "Release Notes",
        "releaseDate": "2020-06-22",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Added",
                "items": [
                    "Competitor Monitoring - allows tracking other airlines"
                ]
            }
        ]
    },
    "0.5.4": {
        "title": "Release Notes",
        "releaseDate": "2020-05-13",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Fixed",
                "items": [
                    "Personnel Management - clicking apply salary no longer fires any excess employees."
                ]
            }
        ]
    },
    "0.5.3": {
        "title": "Release Notes",
        "releaseDate": "2020-05-12",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Added",
                "items": [
                    "Personnel Management Module - allows to quickly change salary of your employees."
                ]
            },
            {
                "title": "Changed",
                "items": [
                    "Route Management Dashboard - select first 50 changed to select first 10.",
                    "Route Management Dashboard - open inventory button changes to max 10.",
                    "Route Management Dashboard - added inventory button next to each row to open inventory page.",
                    "General Dashboard - displays info on last personnel salary change date."
                ]
            },
            {
                "title": "Fixed",
                "items": [
                    "Inventory Pricing and Analysis not working with German language (thanks to @derMaster1"
                ]
            }
        ]
    },
    "0.5.2": {
        "title": "Release Notes",
        "releaseDate": "2020-05-09",
        "summary": "Thanks for keeping AES up to date.",
        "sections": [
            {
                "title": "Milestone",
                "items": [
                    "First release."
                ]
            }
        ]
    }
})

class ReleaseNotesDialog {
    #container
    #backdrop
    #badge
    #body
    #closeButton
    #confirmButton
    #currentIndex
    #nextButton
    #pageIndicator
    #previousButton
    #sections
    #seenVersion
    #title
    #versionLabel
    #versions

    constructor(version) {
        this.#seenVersion = version
        this.#versions = Object.keys(AES_RELEASE_NOTES)
            .filter(function(candidate) {
                return AES.compareVersions(candidate, version) <= 0
            })
            .sort(function(a, b) {
                return AES.compareVersions(b, a)
            })
        this.#currentIndex = Math.max(0, this.#versions.indexOf(version))
        this.#closeButton = this.#createCloseButton()
        this.#confirmButton = this.#createConfirmButton()
        this.#previousButton = this.#createPageButton("Previous", "Previous release notes page")
        this.#nextButton = this.#createPageButton("Next", "Next release notes page")
        this.#pageIndicator = document.createElement("span")
        this.#pageIndicator.className = "aes-release-notes-page-indicator"
        this.#container = this.#createContainer()
        this.#backdrop = this.#createBackdrop()
        document.body.append(this.#backdrop, this.#container)
        AES.markOwnedElements([this.#container, this.#backdrop])
        document.body.classList.add("modal-open")
        this.#bindEvents()
        this.#renderPage()
    }

    #createContainer() {
        const container = document.createElement("div")
        container.id = "aes-release-notes-dialog"
        container.className = "modal fade in"
        container.setAttribute("role", "dialog")
        container.setAttribute("aria-modal", "true")
        container.style.display = "block"
        container.classList.add("aes-release-notes-theme-" + this.#getTheme())

        const dialog = document.createElement("div")
        dialog.className = "modal-dialog modal-lg"

        const content = document.createElement("div")
        content.className = "modal-content"

        const header = document.createElement("div")
        header.className = "modal-header aes-release-notes-header"
        const hero = document.createElement("div")
        hero.className = "aes-release-notes-hero"
        const heroBrand = document.createElement("div")
        heroBrand.className = "aes-release-notes-brand"
        const logo = document.createElement("img")
        logo.className = "aes-release-notes-logo"
        logo.src = chrome.runtime.getURL("images/AES-logo-128.png")
        logo.alt = "AES logo"
        const titleWrap = document.createElement("div")
        titleWrap.className = "aes-release-notes-title-wrap"
        this.#title = document.createElement("h3")
        this.#title.className = "modal-title"
        this.#versionLabel = document.createElement("p")
        this.#versionLabel.className = "aes-release-notes-version"
        this.#badge = document.createElement("span")
        this.#badge.className = "aes-release-notes-badge"
        const productLabel = document.createElement("p")
        productLabel.className = "aes-release-notes-product"
        productLabel.textContent = "AirlineSim Enhancement Suite"

        titleWrap.append(productLabel, this.#title, this.#versionLabel, this.#badge)
        heroBrand.append(logo, titleWrap)
        hero.append(this.#closeButton, heroBrand)
        header.append(hero)

        this.#body = document.createElement("div")
        this.#body.className = "modal-body aes-release-notes-body"
        this.#sections = document.createElement("div")
        this.#sections.className = "aes-release-notes-sections"
        this.#body.append(this.#sections)

        const footer = document.createElement("div")
        footer.className = "modal-footer aes-release-notes-footer"

        const changelogLink = document.createElement("a")
        changelogLink.className = "btn btn-default aes-release-notes-link"
        changelogLink.href = "https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/blob/main/CHANGELOG.md"
        changelogLink.target = "_blank"
        changelogLink.rel = "noopener noreferrer"
        changelogLink.textContent = "View full changelog"

        const pagination = document.createElement("div")
        pagination.className = "aes-release-notes-pagination"
        pagination.append(this.#previousButton, this.#pageIndicator, this.#nextButton)

        footer.append(changelogLink, pagination, this.#confirmButton)
        content.append(header, this.#body, footer)
        dialog.append(content)
        container.append(dialog)

        return container
    }

    #createBackdrop() {
        const backdrop = document.createElement("div")
        backdrop.className = "modal-backdrop fade in aes-release-notes-backdrop"
        return backdrop
    }

    #createCloseButton() {
        const button = document.createElement("button")
        button.setAttribute("type", "button")
        button.className = "close aes-release-notes-close"
        button.setAttribute("aria-label", "Close")
        button.innerHTML = "&times;"
        return button
    }

    #createConfirmButton() {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "btn btn-primary aes-release-notes-confirm"
        button.textContent = "Got it"
        return button
    }

    #createPageButton(text, ariaLabel) {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "btn btn-default aes-release-notes-page-button"
        button.textContent = text
        button.setAttribute("aria-label", ariaLabel)
        return button
    }

    #renderPage() {
        const version = this.#versions[this.#currentIndex]
        const notes = AES_RELEASE_NOTES[version]
        if (!notes) {
            return
        }

        const isLatestRelease = this.#currentIndex === 0
        this.#badge.textContent = isLatestRelease ? "Latest release" : "Release history"
        this.#title.textContent = isLatestRelease
            ? "What's new in v" + version
            : "Release notes for v" + version
        this.#versionLabel.textContent = "Released " + notes.releaseDate
        this.#sections.replaceChildren()

        notes.sections.forEach((section) => {
            const card = document.createElement("section")
            card.className = "aes-release-notes-card"
            const sectionTitle = document.createElement("h4")
            sectionTitle.className = "aes-release-notes-card-title"
            sectionTitle.textContent = section.title

            const list = document.createElement("ul")
            list.className = "aes-release-notes-list"
            section.items.forEach(function(item) {
                const listItem = document.createElement("li")
                listItem.textContent = item
                list.append(listItem)
            })

            card.append(sectionTitle, list)
            this.#sections.append(card)
        })

        this.#previousButton.disabled = this.#currentIndex >= this.#versions.length - 1
        this.#nextButton.disabled = this.#currentIndex === 0
        this.#pageIndicator.textContent = "v" + version
        this.#pageIndicator.setAttribute("aria-label", "Showing release notes for version " + version)
        this.#body.scrollTop = 0
    }

    #showPreviousPage() {
        if (this.#currentIndex >= this.#versions.length - 1) {
            return
        }
        this.#currentIndex++
        this.#renderPage()
    }

    #showNextPage() {
        if (this.#currentIndex <= 0) {
            return
        }
        this.#currentIndex--
        this.#renderPage()
    }

    #bindEvents() {
        const dismiss = this.dismiss.bind(this)
        this.#closeButton.addEventListener("click", dismiss)
        this.#confirmButton.addEventListener("click", dismiss)
        this.#backdrop.addEventListener("click", dismiss)
        this.#previousButton.addEventListener("click", this.#showPreviousPage.bind(this))
        this.#nextButton.addEventListener("click", this.#showNextPage.bind(this))
        document.addEventListener("keydown", this.#onKeydown)
    }

    #onKeydown = (event) => {
        if (event.key === "Escape") {
            this.dismiss()
        } else if (event.key === "ArrowLeft") {
            this.#showPreviousPage()
        } else if (event.key === "ArrowRight") {
            this.#showNextPage()
        }
    }

    dismiss() {
        chrome.storage.local.set({ [AES_RELEASE_NOTES_STORAGE_KEY]: this.#seenVersion }, () => {
            document.removeEventListener("keydown", this.#onKeydown)
            this.#container.remove()
            this.#backdrop.remove()
            document.body.classList.remove("modal-open")
        })
    }

    #getTheme() {
        const theme = window.frontendSettings && window.frontendSettings.theme
        if (theme === "classic" || theme === "light") {
            return theme
        }
        return "dark"
    }
}

function maybeShowReleaseNotes() {
    if (window.top !== window.self) {
        return
    }

    const manifest = chrome.runtime.getManifest()
    const version = manifest.version_name || manifest.version
    const notes = AES_RELEASE_NOTES[version]

    if (!notes) {
        return
    }

    chrome.storage.local.get([AES_RELEASE_NOTES_STORAGE_KEY], function(result) {
        if (result[AES_RELEASE_NOTES_STORAGE_KEY] === version) {
            return
        }

        showReleaseNotesDialog(version)
    })
}

function showReleaseNotesDialog(version) {
    if (!AES.isPageOwner()) {
        return
    }
    if (document.getElementById("aes-release-notes-dialog")) {
        return
    }

    new ReleaseNotesDialog(version)
}

function addReleaseNotesFooterLink() {
    if (!AES.isPageOwner()) {
        return false
    }

    const manifest = chrome.runtime.getManifest()
    const version = manifest.version_name || manifest.version
    const notes = AES_RELEASE_NOTES[version]
    if (!notes) {
        return false
    }

    const footer = document.querySelector("#footer, nav.as-navbar-bottom")
    if (!footer) {
        return false
    }

    const gameVersionAnchor = findGameVersionAnchor(footer)
    if (!gameVersionAnchor) {
        return false
    }

    let wrapper = document.getElementById("aes-footer-version")
    if (!wrapper) {
        wrapper = createFooterVersionLink(version, notes, gameVersionAnchor.wrapperTag)
    }

    AES.markOwnedElements(wrapper)

    return placeFooterVersionLink(wrapper, gameVersionAnchor)
}

function createFooterVersionLink(version, notes, wrapperTag) {
    wrapperTag = wrapperTag || "span"
    const wrapper = document.createElement(wrapperTag)
    wrapper.id = "aes-footer-version"
    wrapper.className = "as-footer-line-element aes-footer-version-element"

    const link = document.createElement("a")
    link.href = "#"
    link.className = "aes-footer-version-link"
    link.textContent = "AES: v" + version
    link.addEventListener("click", function(event) {
        event.preventDefault()
        event.stopPropagation()
        if (event.stopImmediatePropagation) {
            event.stopImmediatePropagation()
        }
        showReleaseNotesDialog(version)
    })
    wrapper.addEventListener("click", function(event) {
        event.stopPropagation()
    })

    wrapper.append(link)
    return wrapper
}

function findGameVersionAnchor(footer) {
    const explicitVersion = footer.querySelector("#version")
    if (explicitVersion) {
        return createElementVersionAnchor(explicitVersion)
    }

    const currentVersion = window.frontendSettings && window.frontendSettings.currentVersionNumber
    const versionCandidates = Array.from(footer.querySelectorAll("[data-version], .version, .as-footer-line-element, span, div"))
        .filter(function(element) {
            return element.id !== "aes-footer-version" && !element.closest("#aes-footer-version")
        })

    const dataVersionCandidate = versionCandidates.find(function(element) {
        const dataVersion = element.getAttribute("data-version")
        return dataVersion && (!currentVersion || dataVersion === currentVersion)
    })
    if (dataVersionCandidate) {
        return createElementVersionAnchor(dataVersionCandidate)
    }

    const ownTextCandidate = versionCandidates.find(function(element) {
        return isGameVersionText(getOwnText(element), currentVersion)
    })
    if (ownTextCandidate) {
        return createElementVersionAnchor(ownTextCandidate)
    }

    const textNodeAnchor = findGameVersionTextNodeAnchor(footer, currentVersion)
    return textNodeAnchor || null
}

function createElementVersionAnchor(element) {
    return {
        parent: element.parentNode,
        beforeNode: element,
        wrapperTag: element.tagName === "DIV" ? "div" : "span"
    }
}

function findGameVersionTextNodeAnchor(footer, currentVersion) {
    const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) {
                return NodeFilter.FILTER_REJECT
            }
            if (node.parentElement && node.parentElement.closest("#aes-footer-version")) {
                return NodeFilter.FILTER_REJECT
            }
            return getGameVersionTokenIndex(node.nodeValue, currentVersion) >= 0
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT
        }
    })

    const textNode = walker.nextNode()
    if (!textNode) {
        return null
    }

    const tokenIndex = getGameVersionTokenIndex(textNode.nodeValue, currentVersion)
    const versionTextNode = tokenIndex > 0 ? textNode.splitText(tokenIndex) : textNode
    const versionContainer = findClosestGameVersionContainer(versionTextNode.parentElement, currentVersion)
    if (versionContainer) {
        return createElementVersionAnchor(versionContainer)
    }

    return {
        parent: versionTextNode.parentNode,
        beforeNode: versionTextNode,
        wrapperTag: "span"
    }
}

function getOwnText(element) {
    return Array.from(element.childNodes)
        .filter(function(node) {
            return node.nodeType === Node.TEXT_NODE
        })
        .map(function(node) {
            return node.nodeValue
        })
        .join(" ")
        .trim()
}

function findClosestGameVersionContainer(element, currentVersion) {
    while (element && !element.matches("#footer, nav.as-navbar-bottom")) {
        const dataVersion = element.getAttribute("data-version")
        if (dataVersion && (!currentVersion || dataVersion === currentVersion)) {
            return element
        }
        if (element.id === "version" || element.classList.contains("version")) {
            return element
        }
        if (isGameVersionText(getOwnText(element), currentVersion)) {
            return element
        }
        element = element.parentElement
    }
    return null
}

function isGameVersionText(text, currentVersion) {
    if (!text) {
        return false
    }

    const normalizedText = text.trim()
    if (currentVersion) {
        return normalizedText === currentVersion || normalizedText === "v" + currentVersion
    }

    return /^v?\d+\.\d+\.\d+$/.test(normalizedText)
}

function getGameVersionTokenIndex(text, currentVersion) {
    if (!text) {
        return -1
    }

    if (currentVersion) {
        const versionWithPrefix = "v" + currentVersion
        const prefixedIndex = text.indexOf(versionWithPrefix)
        if (prefixedIndex >= 0) {
            return prefixedIndex
        }
        return text.indexOf(currentVersion)
    }

    const match = text.match(/v?\d+\.\d+\.\d+/)
    return match ? match.index : -1
}

function placeFooterVersionLink(wrapper, gameVersionAnchor) {
    if (wrapper.parentNode !== gameVersionAnchor.parent || wrapper.nextSibling !== gameVersionAnchor.beforeNode) {
        gameVersionAnchor.parent.insertBefore(wrapper, gameVersionAnchor.beforeNode)
    }
    return true
}

function watchReleaseNotesFooterLink() {
    if (addReleaseNotesFooterLink()) {
        return
    }

    const observer = new MutationObserver(function() {
        if (addReleaseNotesFooterLink()) {
            observer.disconnect()
        }
    })
    observer.observe(document.body, { childList: true, subtree: true })
}

AES.runContentScript("module:release-notes", function() {
    watchReleaseNotesFooterLink()
    maybeShowReleaseNotes()
    AES.whenPageOwnershipLost(function() {
        AES.removeOwnedElements()
        document.body.classList.remove("modal-open")
    })
}, { ready: false });
