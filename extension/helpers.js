/** Shared logic */
class AES {

    /**
     * Safely updates extension settings using the latest stored snapshot.
     * @param {function(object): void} mutator
     * @param {function(object): void} callback
     */
    static updateSettings(mutator, callback) {
        chrome.storage.local.get(['settings'], function(result) {
            let currentSettings = result.settings || {};
            if (typeof mutator === 'function') {
                mutator(currentSettings);
            }
            chrome.storage.local.set({ settings: currentSettings }, function() {
                if (typeof callback === 'function') {
                    callback(currentSettings);
                }
            });
        });
    }

    /**
     * Returns the server name
     * @returns {string} server name
     */
    static getServerName() {
        const hostname = window.location.hostname;
        const servername = hostname.split(".")[0];

        return servername
    }

    /**
     * Returns the airline info from the dashboard, with fallback to localStorage
     * @returns {object} {id:string, name: string, code: string, displayName: string}
     */
    static getAirline() {
        const server = AES.getServerName();
        const serverKey = `${server}_airlinesData`;
        const serverAirlinesData = JSON.parse(localStorage.getItem(serverKey) || '{}');

        let table;
        const url = window.location.href;

        if (
            (url.includes('/app/info/enterprises/') && !url.includes('tab')) ||
            (url.includes('/app/info/enterprises/') && url.includes('tab=0'))
        ) {
            table = $('div.as-table-well table tbody');
        } else {
            table = $('div.as-panel.facts table tbody');
        }

        let displayName = '';
        let code = '';

        table.find('tr').each(function () {
            const tr = $(this);
            let label = '';
            let value = '';

            if (tr.find('th').length > 0) {
                label = tr.find('th').text().trim().toLowerCase();
                value = tr.find('td').text().trim();
            } else {
                label = tr.find('td:first').text().trim().toLowerCase();
                const valueCell = tr.find('td:last');
                value = valueCell.find('span, a').length > 0
                    ? valueCell.find('span, a').first().text().trim()
                    : valueCell.text().trim();
            }

            if (label === 'name') {
                displayName = value;
            }
            if (label === 'code') {
                code = value.replace(/[^A-Za-z0-9]/g, '');
            }
        });

        if (!displayName) {
            if (
                url.includes('/app/enterprise/dashboard') ||
                (url.includes('/app/info/enterprises/') && !url.includes('tab')) ||
                (url.includes('/app/info/enterprises/') && url.includes('tab=0'))
            ) {
                // no fallback
            } else if (url.includes('/app/info/enterprises/') && url.includes('tab') && !url.includes('tab=0')) {
                displayName = $('h2 span').first().text().trim();
            } else {
                displayName = $('.as-navbar-main .dropdown > a.name span').first().text().trim() ||
                    $('.as-navbar-main .dropdown > a.name').first().text().trim() ||
                    $('title').text().split('|')[0].trim();
            }
        }

        const href = $('a[href*="tab=2"]').attr('href') || $('a[href*="enterprises/"]').attr('href');
        const match = href?.match(/enterprises\/(\d+)/) || href?.match(/\.\/(\d+)/);
        const idFromHref = match ? match[1] : null;
        const name = displayName
            ? displayName.replace(/[^A-Za-z0-9]/g, '_')
            : (idFromHref ? `airline_${idFromHref}` : null);

        if (!name) {
            throw new Error("Unable to determine airline from the current page");
        }

        if (typeof serverAirlinesData[name] !== 'object' || serverAirlinesData[name] === null) {
            serverAirlinesData[name] = {};
        }

        let id = idFromHref || serverAirlinesData[name].id || null;

        if (!code && serverAirlinesData[name].code) {
            code = serverAirlinesData[name].code;
        }

        serverAirlinesData[name].id = id;
        serverAirlinesData[name].code = code;

        localStorage.setItem(serverKey, JSON.stringify(serverAirlinesData));

        return { id: id, code: code, name: name, displayName: displayName };
    }

    /**
     * Returns the airline currently controlled by the user from the navbar.
     * @returns {object} {id:string, name: string, code: string, displayName: string}
     */
    static getCurrentAirline() {
        const server = AES.getServerName();
        const serverKey = `${server}_airlinesData`;
        const serverAirlinesData = JSON.parse(localStorage.getItem(serverKey) || '{}');
        const displayName = $('.as-navbar-main .dropdown > a.name span').first().text().trim() ||
            $('.as-navbar-main .dropdown > a.name').first().text().trim();
        const name = displayName ? displayName.replace(/[^A-Za-z0-9]/g, '_') : null;
        const data = name ? serverAirlinesData[name] : null;
        let id = data?.id || null;
        let code = data?.code || '';

        $('.as-navbar-main .dropdown-menu a[href*="/app/enterprise/dashboard?select="]').each(function () {
            const link = $(this);
            const linkName = link.find('span').first().text().trim() || link.text().trim();
            if (linkName !== displayName) {
                return;
            }

            const href = link.attr('href') || '';
            const match = href.match(/select=(\d+)/);
            if (match) {
                id = match[1];
            }
            return false;
        });

        if (name) {
            if (typeof serverAirlinesData[name] !== 'object' || serverAirlinesData[name] === null) {
                serverAirlinesData[name] = {};
            }
            if (id) {
                serverAirlinesData[name].id = id;
            }
            if (code) {
                serverAirlinesData[name].code = code;
            }
            localStorage.setItem(serverKey, JSON.stringify(serverAirlinesData));
        }

        return {
            id: id,
            code: code,
            name: name,
            displayName: displayName
        };
    }

    /**
     * Returns the storage key for a competitor-monitoring record.
     * @param {string} server
     * @param {string} ownerAirlineId
     * @param {string} competitorAirlineId
     * @returns {string}
     */
    static getCompetitorMonitoringKey(server, ownerAirlineId, competitorAirlineId) {
        if (ownerAirlineId) {
            return `${server}${ownerAirlineId}_${competitorAirlineId}competitorMonitoring`;
        }

        return `${server}${competitorAirlineId}competitorMonitoring`;
    }

    /**
     * Returns the storage key for the owner-scoped competitor-monitoring index.
     * @param {string} server
     * @param {string} ownerAirlineId
     * @returns {string}
     */
    static getCompetitorMonitoringIndexKey(server, ownerAirlineId) {
        return `${server}${ownerAirlineId}competitorMonitoringIndex`;
    }

    /**
     * Formats a currency value local standards
     * @param {integer} currency value
     * @param {string} alignment: "right" | "left"
     * @returns {HTMLElement} span with formatted value
     */
    static formatCurrency(value, alignment) {
        let container = document.createElement("span")
        let formattedValue = Intl.NumberFormat().format(value)
        let indicatorEl = document.createElement("span")
        let valueEl = document.createElement("span")
        let currencyEl = document.createElement("span")
        let containerClasses = "aes-no-text-wrap"

        if (alignment === "right") {
            containerClasses = "aes-text-right aes-no-text-wrap"
        }

        if (value >= 0) {
            valueEl.classList.add("good")
            indicatorEl.classList.add("good")
            indicatorEl.innerText = "+"
        }

        if (value < 0) {
            valueEl.classList.add("bad")
            indicatorEl.classList.add("bad")
            indicatorEl.innerText = "-"
            formattedValue = formattedValue.replace("-", "")
        }

        valueEl.innerText = formattedValue
        currencyEl.innerText = " AS$"

        container.className = containerClasses
        container.append(indicatorEl, valueEl, currencyEl)

        return container
    }

    /**
     * Formats a date string to human readable format
     * @param {string} "20240524"
     * @returns {string} "2024-05-24" | "error: invalid format for AES.formatDateString"
     */
    static formatDateString(date) {
        if (!date) {
            return
        }

        const correctLength = date.length === 8
        const isInteger = Number.isInteger(parseInt(date))
        let result = "error: invalid format for AES.formatDateString"

        if (correctLength && isInteger) {
            const year = date.substring(0, 4)
            const month = date.substring(4, 6)
            const day = date.substring(6, 8)
            result = `${year}-${month}-${day}`
        }

        return result
    }
    /**
     * Returns a formatted date (week) string
     * @param {string} "212024"
     * @returns {string} "21/2014 | "error: invalid format for AES.formatDateStringWeek"
     */
    static formatDateStringWeek(date) {
        const correctLength = date.toString().length === 6
        const isInteger = Number.isInteger(parseInt(date))
        let result = "error: invalid format for AES.formatDateStringWeek"

        if (correctLength && isInteger) {
            const DateAsString = date.toString()
            const week = DateAsString.substring(0, 2)
            const year = DateAsString.substring(2, 6)

            result = `${week}/${year}`
        }

        return result
    }

    /**
     * Gets the server’s current date and time
     * @returns {object} datetime - { date: "20240607", time: "16:24 UTC" }
     */
    static getServerDate() {
        const sources = AES.#getServerDateSources()
        for (let i = 0; i < sources.length; i++) {
            const parsed = AES.#parseServerDateSource(sources[i])
            if (parsed) {
                return parsed
            }
        }

        const settingsDate = AES.#getServerDateFromFrontendSettings()
        if (settingsDate) {
            return settingsDate
        }

        throw new Error("Unable to read server date from the page footer. Check AES.getServerDate()")
    }

    static #getServerDateSources() {
        const sources = []
        const addSource = function(value) {
            const source = String(value || "").trim()
            if (source && sources.indexOf(source) === -1) {
                sources.push(source)
            }
        }

        const footer = document.querySelector(".as-navbar-bottom")
        const clockIcon = footer ? footer.querySelector(".fa-clock-o") : null
        const clockCandidates = [
            clockIcon,
            clockIcon && clockIcon.parentElement,
            clockIcon && clockIcon.closest("span"),
            clockIcon && clockIcon.closest("li"),
            clockIcon && clockIcon.closest("div"),
            footer,
        ]

        clockCandidates.forEach(function(element) {
            if (!element) {
                return
            }
            addSource(element.innerText || element.textContent)
            addSource(element.getAttribute && element.getAttribute("title"))
            addSource(element.getAttribute && element.getAttribute("aria-label"))
        })

        if (footer) {
            Array.from(footer.childNodes || []).forEach(function(node) {
                addSource(node.innerText || node.textContent)
            })
        }

        return sources
    }

    static #parseServerDateSource(source) {
        source = String(source || "").replace(/\s+/g, " ").trim()
        if (!source) {
            return null
        }

        const patterns = [
            /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})[\sT]+(\d{1,2}):(\d{2})\s*([A-Z]{2,4})?/i,
            /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})[\sT]+(\d{1,2}):(\d{2})\s*([A-Z]{2,4})?/i,
        ]

        for (let i = 0; i < patterns.length; i++) {
            const match = source.match(patterns[i])
            if (!match) {
                continue
            }

            let year
            let month
            let day
            if (i === 0) {
                year = parseInt(match[1], 10)
                month = parseInt(match[2], 10)
                day = parseInt(match[3], 10)
            } else {
                day = parseInt(match[1], 10)
                month = parseInt(match[2], 10)
                year = parseInt(match[3], 10)
                if (year < 100) {
                    year += 2000
                }
            }

            const hours = parseInt(match[4], 10)
            const minutes = parseInt(match[5], 10)
            const timezone = (match[6] || "UTC").toUpperCase()
            const date = new Date(Date.UTC(year, month - 1, day, hours, minutes))
            if (
                date.getUTCFullYear() !== year ||
                date.getUTCMonth() !== month - 1 ||
                date.getUTCDate() !== day ||
                date.getUTCHours() !== hours ||
                date.getUTCMinutes() !== minutes
            ) {
                continue
            }

            return {
                date: `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`,
                time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${timezone}`
            }
        }

        return null
    }

    static #getServerDateFromFrontendSettings() {
        const settingsTime = globalThis.frontendSettings &&
            globalThis.frontendSettings.server &&
            globalThis.frontendSettings.server.time
        if (!settingsTime) {
            return null
        }

        const parsedTime = new Date(settingsTime)
        if (isNaN(parsedTime.getTime())) {
            return null
        }

        const year = String(parsedTime.getUTCFullYear())
        const month = String(parsedTime.getUTCMonth() + 1).padStart(2, "0")
        const day = String(parsedTime.getUTCDate()).padStart(2, "0")
        const hours = String(parsedTime.getUTCHours()).padStart(2, "0")
        const minutes = String(parsedTime.getUTCMinutes()).padStart(2, "0")

        return {
            date: `${year}${month}${day}`,
            time: `${hours}:${minutes} UTC`
        }
    }

    /**
     * Returns the difference between dates in days
     * @param {array} ["20240520", "20240524"]
     * @returns {integer} 4
     */
    static getDateDiff(dates) {
        let dateA = new Date(`${this.formatDateString(dates[0])}T12:00:00Z`)
        let dateB = new Date(`${this.formatDateString(dates[1])}T12:00:00Z`)
        let result = Math.round((dateA - dateB)/(1000 * 60 * 60 * 24))

        return result
    }

    /**
     * Cleans a string of punctuation to returns an integer
     * @param {string} value - "-2,000 AS$" | "2.000 AS$" | "256"
     * @returns {integer} -2000 | 2000 | 256
     */
    static cleanInteger(value) {
        if (typeof value !== 'string') {
            value = String(value);
        }
        value = value.trim();
        value = value.replace(/[,.\s]|AS\$/g, '');
        const cleaned = value.replace(/[^\d-]/g, '');
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? 0 : parsed;
    }

    // Sleep for some time
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Open pages with delay
    static async openPagesWithDelay(pages) {
        for (let i = 0; i < pages.length; i++) {
            if (i >= 20) break;
            window.open(pages[i], '_blank');
            await AES.sleep(200);  // 改成非零
        }
    }

    /**
     * Returns the current AES extension version.
     * @returns {string}
     */
    static getVersion() {
        const manifest = chrome.runtime.getManifest();
        return manifest.version_name || manifest.version || "0.0.0";
    }

    /**
     * Compares AES versions, including legacy letter suffixes such as 0.7.0d.
     * @param {string} versionA
     * @param {string} versionB
     * @returns {integer} 1 | 0 | -1
     */
    static compareVersions(versionA, versionB) {
        function parseVersion(value) {
            const match = String(value || "0.0.0").trim().match(/^(\d+)\.(\d+)\.(\d+)([A-Za-z]*)$/);
            if (!match) {
                return { major: 0, minor: 0, patch: 0, suffix: "" };
            }

            return {
                major: parseInt(match[1], 10),
                minor: parseInt(match[2], 10),
                patch: parseInt(match[3], 10),
                suffix: (match[4] || "").toLowerCase()
            };
        }

        const a = parseVersion(versionA);
        const b = parseVersion(versionB);
        const numericKeys = ["major", "minor", "patch"];

        for (let i = 0; i < numericKeys.length; i++) {
            const key = numericKeys[i];
            if (a[key] > b[key]) {
                return 1;
            }
            if (a[key] < b[key]) {
                return -1;
            }
        }

        if (a.suffix === b.suffix) {
            return 0;
        }
        if (!a.suffix) {
            return 1;
        }
        if (!b.suffix) {
            return -1;
        }
        return a.suffix > b.suffix ? 1 : -1;
    }

    /**
     * Claims control of the current page for this AES version.
     * @returns {boolean}
     */
    static claimPageControl() {
        AES.#ensurePageControlMonitor();

        const marker = AES.#getPageControlMarker(true);
        const ownVersion = AES.getVersion();
        const ownOwner = chrome.runtime.id;
        const activeVersion = marker.getAttribute("data-version") || "";
        const activeOwner = marker.getAttribute("data-owner") || "";
        const versionComparison = AES.compareVersions(ownVersion, activeVersion);
        const sameVersionTieBreak = versionComparison === 0 && (!activeOwner || ownOwner < activeOwner);
        const shouldClaim = !activeOwner || !activeVersion || versionComparison > 0 || sameVersionTieBreak;

        if (shouldClaim) {
            marker.setAttribute("data-owner", ownOwner);
            marker.setAttribute("data-version", ownVersion);
        }

        AES.#refreshPageOwnership();
        return AES.isPageOwner();
    }

    /**
     * Returns whether the current extension instance owns the page.
     * @returns {boolean}
     */
    static isPageOwner() {
        AES.#ensurePageControlMonitor();
        return !!AES._pageOwner;
    }

    /**
     * Convenience wrapper used by content scripts and shared modules.
     * @param {string} scriptName
     * @returns {boolean}
     */
    static shouldRunContentScript(scriptName) {
        const allowed = AES.claimPageControl();
        if (!allowed) {
            console.info("[AES] Skipping initialization because a newer AES version is active on this page.", scriptName || "");
        }
        return allowed;
    }

    /**
     * Safely starts a content script and reports initialization/runtime errors in-page.
     * @param {string} scriptName
     * @param {function(): void|Promise<void>} initializer
     * @param {object} options
     * @returns {boolean}
     */
    static runContentScript(scriptName, initializer, options) {
        const allowed = AES.shouldRunContentScript(scriptName);
        if (!allowed) {
            return false;
        }

        AES.#installContentScriptErrorReporter(scriptName);

        const run = function() {
            AES.tryRun(scriptName, initializer);
        };

        if (options && options.ready === false) {
            run();
        } else if (typeof $ === "function") {
            $(run);
        } else if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", run, { once: true });
        } else {
            run();
        }

        return true;
    }

    /**
     * Runs a callback and reports synchronous or Promise errors.
     * @param {string} scriptName
     * @param {function(): void|Promise<void>} callback
     */
    static tryRun(scriptName, callback) {
        try {
            const result = typeof callback === "function" ? callback() : null;
            if (result && typeof result.catch === "function") {
                result.catch(function(error) {
                    AES.reportContentScriptError(scriptName, error);
                });
            }
            return result;
        } catch (error) {
            AES.reportContentScriptError(scriptName, error);
            return null;
        }
    }

    /**
     * Reports a content script error to the console and the page UI.
     * @param {string} scriptName
     * @param {Error|any} error
     */
    static reportContentScriptError(scriptName, error) {
        const errorMessage = error && error.message ? error.message : String(error || "Unknown error");
        const message = `AES ${scriptName || "content script"} error: ${errorMessage}`;
        console.error(`[AES] ${scriptName || "content script"} failed`, error);

        const key = `${scriptName || ""}:${errorMessage}`;
        AES._reportedErrors = AES._reportedErrors || {};
        if (AES._reportedErrors[key]) {
            return;
        }
        AES._reportedErrors[key] = true;
        AES.writeLog("error", scriptName || "content script", errorMessage, {
            stack: error && error.stack ? String(error.stack) : "",
        });

        try {
            if (typeof Notifications === "function") {
                new Notifications().add(message, { type: "error", duration: 12000 });
                return;
            }
        } catch (notificationError) {
            console.error("[AES] Notification error reporting failed", notificationError);
        }

        AES.#showFallbackError(message);
    }

    /**
     * Writes a lightweight AES log entry into a daily chrome.storage item.
     * @param {string} level
     * @param {string} source
     * @param {string} message
     * @param {object} details
     */
    static writeLog(level, source, message, details) {
        if (!globalThis.chrome || !chrome.storage || !chrome.storage.local) {
            return;
        }

        const now = new Date();
        const dateKey = AES.#formatLogDate(now);
        const storageKey = `aesLog_${dateKey}`;
        const entry = {
            time: now.toISOString(),
            level: level || "info",
            source: source || "",
            message: String(message || ""),
            url: window.location.href,
            version: AES.getVersion(),
        };

        if (details && typeof details === "object") {
            entry.details = details;
        }

        chrome.storage.local.get([storageKey], function(result) {
            if (chrome.runtime.lastError) {
                console.error("[AES] Unable to read log storage", chrome.runtime.lastError);
                return;
            }

            const logData = result[storageKey] && typeof result[storageKey] === "object"
                ? result[storageKey]
                : {
                    type: "log",
                    date: dateKey,
                    entries: [],
                };
            const entries = Array.isArray(logData.entries) ? logData.entries : [];

            entries.push(entry);
            logData.type = "log";
            logData.date = dateKey;
            logData.updateTime = now.toISOString();
            logData.entries = entries.slice(-300);

            chrome.storage.local.set({ [storageKey]: logData }, function() {
                if (chrome.runtime.lastError) {
                    console.error("[AES] Unable to write log storage", chrome.runtime.lastError);
                }
            });
        });
    }

    /**
     * Registers a callback that fires when this AES instance loses page ownership.
     * @param {function(): void} callback
     */
    static whenPageOwnershipLost(callback) {
        if (typeof callback !== "function") {
            return;
        }
        AES.#ensurePageControlMonitor();
        AES._ownershipLostCallbacks.push(callback);
    }

    /**
     * Marks elements as belonging to this AES instance.
     * @param {HTMLElement|Array|NodeList|jQuery} elements
     */
    static markOwnedElements(elements) {
        if (!elements) {
            return;
        }

        const ownOwner = chrome.runtime.id;
        const ownVersion = AES.getVersion();
        const mark = function(element) {
            if (!element || !element.setAttribute) {
                return;
            }
            element.setAttribute("data-aes-owner", ownOwner);
            element.setAttribute("data-aes-version", ownVersion);
        };

        if (typeof elements.each === "function") {
            elements.each(function() {
                mark(this);
            });
            return;
        }

        if (Array.isArray(elements) || (typeof elements.length === "number" && elements !== window && !elements.nodeType)) {
            Array.from(elements).forEach(mark);
            return;
        }

        mark(elements);
    }

    /**
     * Removes DOM nodes owned by this AES instance.
     */
    static removeOwnedElements() {
        const selector = `[data-aes-owner="${chrome.runtime.id}"][data-aes-version="${AES.getVersion()}"]`;
        document.querySelectorAll(selector).forEach(function(node) {
            node.remove();
        });
    }

    static #getPageControlMarker(createIfMissing) {
        let marker = document.getElementById("aes-page-control");
        if (!marker && createIfMissing) {
            marker = document.createElement("meta");
            marker.id = "aes-page-control";
            marker.setAttribute("name", "aes-page-control");
            (document.head || document.documentElement).append(marker);
        }
        return marker;
    }

    static #ensurePageControlMonitor() {
        if (AES._pageControlInitialized) {
            return;
        }

        AES._pageControlInitialized = true;
        AES._pageOwner = false;
        AES._ownershipLostCallbacks = [];
        const marker = AES.#getPageControlMarker(true);
        AES._pageControlObserver = new MutationObserver(function() {
            AES.#refreshPageOwnership();
        });
        AES._pageControlObserver.observe(marker, {
            attributes: true,
            attributeFilter: ["data-owner", "data-version"]
        });
        AES.#refreshPageOwnership();
    }

    static #installContentScriptErrorReporter(scriptName) {
        if (AES._contentScriptErrorReporterInstalled) {
            return;
        }
        AES._contentScriptErrorReporterInstalled = true;

        window.addEventListener("error", function(event) {
            if (event && event.error) {
                AES.reportContentScriptError("runtime", event.error);
            }
        });
        window.addEventListener("unhandledrejection", function(event) {
            AES.reportContentScriptError("runtime", event.reason || "Unhandled promise rejection");
        });
    }

    static #showFallbackError(message) {
        const container = document.querySelector(".feedbackPanel") || document.createElement("ul");
        if (!container.classList.contains("feedbackPanel")) {
            container.className = "feedbackPanel";
        }

        const item = document.createElement("li");
        item.className = "feedbackPanelERROR";
        const content = document.createElement("span");
        content.innerText = ` ${message}`;
        item.append(content);
        container.append(item);

        if (!container.parentNode) {
            const target = document.querySelector("nav.as-navbar-main + .container-fluid") || document.body || document.documentElement;
            target.prepend(container);
        }

        window.setTimeout(function() {
            item.remove();
        }, 12000);
    }

    static #formatLogDate(date) {
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}${month}${day}`;
    }

    static #refreshPageOwnership() {
        const marker = AES.#getPageControlMarker(true);
        const previousOwnerState = !!AES._pageOwner;
        AES._pageOwner = marker.getAttribute("data-owner") === chrome.runtime.id &&
            marker.getAttribute("data-version") === AES.getVersion();

        if (previousOwnerState && !AES._pageOwner) {
            AES._ownershipLostCallbacks.forEach(function(callback) {
                try {
                    callback();
                } catch (error) {
                    console.error("[AES] Ownership lost callback failed", error);
                }
            });
        }
    }


}

AES.claimPageControl();
