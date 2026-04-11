/** Shared logic */
class AES {

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
     * Exposes debug data to the page context so it can be read from DevTools.
     * @param {string} name
     * @param {object} payload
     */
    static exposeDebug(name, payload) {
        try {
            const key = `aes_debug_${name}`;
            const value = JSON.stringify(payload);

            try {
                localStorage.setItem(key, value);
            } catch (error) {
                // ignore storage write failures
            }

            const debugNodeId = `aes-debug-${name}`;
            let debugNode = document.getElementById(debugNodeId);
            if (!debugNode) {
                debugNode = document.createElement('script');
                debugNode.id = debugNodeId;
                debugNode.type = 'application/json';
                (document.body || document.documentElement || document.head).appendChild(debugNode);
            }
            debugNode.textContent = value;

            document.documentElement.setAttribute(`data-aes-debug-${name}`, value);
        } catch (error) {
            // ignore debug write failures
        }
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


}
