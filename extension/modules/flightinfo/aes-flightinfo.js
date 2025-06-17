class AESFlightInfo {
    #data = null;

    constructor() {
        // Initialize only
    }

    /**
     * Initializes the AESFlightInfo module
     * @returns {Promise<void>}
     */
    async init() {
        if (this.#isPrivateFlight() && this.#isCorrectTabOpen()) {
            this.#data = this.#collectFlightData();
            await this.#saveData();
            this.#render();
        }
    }


    /**
     * Checks if the flight is private by looking for the 'privInf' element
     * @returns {boolean}
     */
    #isPrivateFlight() {
        return document.getElementById('privInf') !== null;
    }

    /**
     * Checks if the correct tab is open for flight information
     * @returns {boolean}
     */
    #isCorrectTabOpen() {
        const tab = document.querySelector('#flight-page > ul > li');
        return tab && tab.classList.contains('active');
    }

    /**
     * Collects flight data from the current page
     * @returns {{server: string, flightId: number, type: string, money: data, date, time: string}}
     */
    #collectFlightData() {
        const flightId = this.#getFlightId();
        const dateTime = AES.getServerDate();
        const money = this.#getFinancials();

        return {
            server: AES.getServerName(),
            flightId,
            type: 'flightInfo',
            money,
            date: dateTime.date,
            time: dateTime.time
        };
    }

    /**
     * Extracts the flight ID from the current URL
     * @returns {number}
     */
    #getFlightId() {
        const url = new URL(window.location.href);
        return parseInt(url.searchParams.get("id"), 10);
    }

    /**
     * Extracts financial data from the flight information table
     * @returns data - an object containing financial data for each stage CM1 to CM5
     */
    #getFinancials() {
        const data = {};
        document.querySelectorAll('.cm').forEach((row, index) => {
            const cmLabel = `CM${index + 1}`;
            data[cmLabel] = {};
            const labels = ['Y', 'C', 'F', 'PAX', 'Cargo', 'Total'];
            row.querySelectorAll('td').forEach((cell, i) => {
                const label = labels[i];
                const value = AES.cleanInteger(cell.textContent);
                if (label) data[cmLabel][label] = value;
            });
        });
        return data;
    }

    /**
     * Saves the flight data to local storage
     * @returns {Promise<void>}
     */
    async #saveData() {
        const key = `${this.#data.server}${this.#data.type}${this.#data.flightId}`;
        const notifications = new Notifications();
        try {
            await chrome.storage.local.set({ [key]: this.#data });
            const result = await chrome.storage.local.get(['settings']);
            if (result?.settings?.flightInfo?.autoClose) {
                window.close();
            }
            notifications.add("Flight information saved successfully.", {type: "success"});
        } catch (e) {
            notifications.add("Flight information save failed.", {type: "error"});
            console.error(e);
        }
    }

    /**
     * Renders the flight information panel on the page
     */
    #render() {
        const panel = this.#createPanel();
        const heading = this.#createHeading();
        const container = this.#createContainer(heading, panel);

        const anchor = document.querySelector('body > .container-fluid > h1');

        if (anchor) {
            anchor.insertAdjacentElement('afterend', container);
        }
    }

    /**
     * Builds the heading for the flight information panel
     * @returns {HTMLHeadingElement}
     */
    #createHeading() {
        const heading = document.createElement('h3');
        heading.textContent = 'AES Flight Information';
        return heading;
    }

    /**
     * Builds the flight information panel
     * @returns {HTMLDivElement}
     */
    #createPanel() {
        const table = this.#buildTable();

        const well = document.createElement('div');
        well.className = 'as-table-well';
        well.appendChild(table);

        const panel = document.createElement('div');
        panel.className = 'as-panel';
        panel.appendChild(well);

        return panel;
    }

    /**
     * Builds the container for the flight information panel
     * @param heading
     * @param panel
     * @returns {HTMLDivElement}
     */
    #createContainer(heading, panel) {
        const container = document.createElement('div');
        container.appendChild(heading);
        container.appendChild(panel);
        return container;
    }

    /**
     * Builds the main table for displaying flight information
     * @returns {HTMLTableElement}
     */
    #buildTable() {
        const table = document.createElement('table');
        table.className = 'aes-table table table-bordered table-striped table-hover';
        table.appendChild(this.#buildTableHead());
        table.appendChild(this.#buildTableBody());
        // Footer is not really needed from my perspective
        //table.appendChild(this.#buildTableFooter());
        return table;
    }

    /**
     * Builds the table head with column labels
     * @returns {HTMLTableSectionElement}
     */
    #buildTableHead() {
        const labels = ['', 'Y', 'C', 'F', 'PAX', 'Cargo', 'Total'];
        const thead = document.createElement('thead');
        const row = document.createElement('tr');
        labels.forEach(label => {
            const th = document.createElement('th');
            th.className = 'aes-text-right';
            th.textContent = label;
            row.appendChild(th);
        });
        thead.appendChild(row);
        return thead;
    }

    /**
     * Builds the table body with financial data
     * @returns {HTMLTableSectionElement}
     */
    #buildTableBody() {
        const tbody = document.createElement('tbody');
        Object.entries(this.#data.money).forEach(([cm, values]) => {
            const row = document.createElement('tr');
            const th = document.createElement('th');
            th.textContent = cm;
            row.appendChild(th);
            ['Y', 'C', 'F', 'PAX', 'Cargo', 'Total'].forEach(label => {
                const td = document.createElement('td');
                td.className = 'aes-text-right';
                const currencyEl = AES.formatCurrency(values[label], "right");
                td.appendChild(currencyEl);
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        return tbody;
    }

    /**
     * Builds the table footer with flight information
     * @returns {HTMLTableSectionElement}
     */
    #buildTableFooter() {
        const tfoot = document.createElement('tfoot');
        const blankRow = document.createElement('tr');
        const blankTd = document.createElement('td');
        blankTd.colSpan = 7;
        blankRow.appendChild(blankTd);

        const row = document.createElement('tr');
        const cells = [
            'Flight Id:', this.#data.flightId,
            'Date:', `${AES.formatDateString(this.#data.date)} ${this.#data.time}`,
            '', '', ''
        ];
        cells.forEach(cell => {
            const th = document.createElement('th');
            th.textContent = cell;
            row.appendChild(th);
        });

        tfoot.appendChild(blankRow);
        tfoot.appendChild(row);
        return tfoot;
    }
}

// Initialize the AESFlightInfo class when the DOM is fully loaded
//document.addEventListener('DOMContentLoaded', async () => {
//    const flightInfo = new AESFlightInfo();
//    await flightInfo.init();
//});

// Because this AS-Site not fires the DOMContentLoaded event, we need to force the run!
new AESFlightInfo().init();
