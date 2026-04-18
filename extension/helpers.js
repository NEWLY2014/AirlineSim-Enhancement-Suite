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
        const source = document.querySelector(".as-navbar-bottom span:has(.fa-clock-o)").innerText.trim()
        const sourceAsNumbers = source.toString().replace(/\D/g, "")

        // The source always consists of 12 numbers
        const expectedLength = 12
        if (sourceAsNumbers.length != expectedLength) {
            throw new Error(`Unexpected length for source (${sourceAsNumbers.length}). There might’ve been a UI update. Check AES.getServerDate()`)
        }

        // Splits the date component from the data,
        // then splits that into an array for the year, month, and day
        let dateArray = source.split(" ")[0].split(/\D+/)
        if (dateArray[0].length === 2) {
            dateArray.reverse()
        }
        let date = dateArray[0]+dateArray[1]+dateArray[2]

        // Strip the date component from the data
        // leaving only the time
        let time = source.replace(/.{10}\s/, "")

        const datetime = {
            date: date,
            time: time
        }

        return datetime
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
