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
        console.debug('Loaded serverAirlinesData:', serverAirlinesData);

        let table;
        const url = window.location.href;

        // Selector logic
        if (
            (url.includes('/app/info/enterprises/') && !url.includes('tab')) ||
            (url.includes('/app/info/enterprises/') && url.includes('tab=0'))
        ) {
            table = $('div.as-table-well table tbody');
            console.debug('Using as-table-well selector');
        } else {
            table = $('div.as-panel.facts table tbody');
            console.debug('Using as-panel.facts selector');
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

            console.debug('Table row label:', label, '| value:', value);

            if (label === 'name') {
                displayName = value;
                console.debug('Extracted displayName from table:', displayName);
            }
            if (label === 'code') {
                code = value.replace(/[^A-Za-z0-9]/g, '');
                console.debug('Extracted code from table:', code);
            }
        });

        // Fallback logic
        if (!displayName) {
            if (
                url.includes('/app/enterprise/dashboard') ||
                (url.includes('/app/info/enterprises/') && !url.includes('tab')) ||
                (url.includes('/app/info/enterprises/') && url.includes('tab=0'))
            ) {
                console.debug('No fallback (page type excludes fallback)');
            } else if (url.includes('/app/info/enterprises/') && url.includes('tab') && !url.includes('tab=0')) {
                displayName = $('h2 span').first().text().trim();
                console.debug('Fallback displayName from <h2><span>:', displayName);
            } else {
                displayName = $('.as-navbar-main .dropdown > a.name span').first().text().trim() ||
                    $('.as-navbar-main .dropdown > a.name').first().text().trim() ||
                    $('title').text().split('|')[0].trim();
                console.debug('Fallback displayName from navbar or title:', displayName);
            }
        }

        const name = displayName.replace(/[^A-Za-z0-9]/g, '_');
        console.debug('Normalized name key:', name);

        if (typeof serverAirlinesData[name] !== 'object' || serverAirlinesData[name] === null) {
            serverAirlinesData[name] = {};
            console.debug(`Initialized new entry for ${name}`);
        }

        const href = $('a[href*="tab=2"]').attr('href') || $('a[href*="enterprises/"]').attr('href');
        const match = href?.match(/enterprises\/(\d+)/) || href?.match(/\.\/(\d+)/);
        let id = match ? match[1] : serverAirlinesData[name].id || null;
        console.debug('Extracted or fallback ID:', id);

        if (!code && serverAirlinesData[name].code) {
            code = serverAirlinesData[name].code;
            console.debug('Fallback code from localStorage:', code);
        }

        serverAirlinesData[name].id = id;
        serverAirlinesData[name].code = code;

        localStorage.setItem(serverKey, JSON.stringify(serverAirlinesData));
        console.debug('Updated serverAirlinesData saved:', serverAirlinesData);

        return { id: id, code: code, name: name, displayName: displayName };
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

}
