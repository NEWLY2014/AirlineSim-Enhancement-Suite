class OnlineReservationSystem {
    static LOCAL_STORAGE_KEY = 'tmp_ors_maxRating';
    #maxRating

    constructor() {
        this.#maxRating = -100;
    }

    init() {
        this.#restoreMaxRating();
        this.#clearStoredMaxRating();
        this.#addNumberToRating();
        this.#addDifferenceColumn();
        this.#setupNavigationPersistence();
    }

    /**
     * Restores the maximum rating from localStorage.
     */
    #restoreMaxRating() {
        try {
            const stored = localStorage.getItem(OnlineReservationSystem.LOCAL_STORAGE_KEY);
            if (stored !== null) {
                this.#maxRating = parseInt(stored, 10);
            }
        } catch (e) {
            console.error('Failed to access localStorage:', e);
        }
    }

    /**
     * Clears the stored maximum rating from localStorage.
     */
    #clearStoredMaxRating() {
        try {
            localStorage.removeItem(OnlineReservationSystem.LOCAL_STORAGE_KEY);
        } catch (e) {
            // Ignore
        }
    }

    /**
     * Adds a span element with the rating number next to each image in the rating and aircraft columns.
     */
    #addNumberToRating(){
        const cells = document.querySelectorAll('td.rating, td.aircraft');
        cells.forEach(td => {
            const img = td.querySelector('img');
            if (img) {
                const title = img.getAttribute('title');
                const number = title && title.match(/-?\d+/)?.[0];
                if (number) {
                    img.insertAdjacentElement('afterend', this.#generateSpanElement(number));
                }
            }
        });
    }

    /**
     * Sets up click event listeners on navigation links to persist the current max rating in localStorage.
     */
    #setupNavigationPersistence() {
        document.querySelectorAll('.navigation a[href]').forEach(link => {
            link.addEventListener('click', () => {
                localStorage.setItem(OnlineReservationSystem.LOCAL_STORAGE_KEY, this.#maxRating);
            });
        });
    }

    /**
     * Generates a span element with the specified text.
     * @param text
     * @returns {HTMLSpanElement}
     */
    #generateSpanElement(text) {
        const span = document.createElement('span');
        span.textContent = text;
        span.className = 'aes-text-left';
        return span;
    }

    /**
     * Adds a "Difference" column to the results table, showing the difference between the maximum rating and the current rating.
     */
    #addDifferenceColumn() {
        const table = this.#getResultsTable();
        if (!table) return;

        const localMaxRating = this.#getMaxRatingFromTable(table);
        this.#maxRating = Math.max(localMaxRating, this.#maxRating);

        const tbodies = table.querySelectorAll('tbody');
        tbodies.forEach(tbody => this.#processTbody(tbody));
    }

    /**
     * Gets the results table element from the DOM.
     * @returns {Element}
     */
    #getResultsTable() {
        return document.querySelector('.ors-result .as-panel .as-table-well > table.table');
    }

    /**
     * Extracts the maximum rating from the table.
     * @param table
     * @returns {number}
     */
    #getMaxRatingFromTable(table) {
        const ratingImgs = table.querySelectorAll('td.rating img');
        const ratings = Array.from(ratingImgs).map(img => {
            const title = img.getAttribute('title');
            return title ? parseInt(title.match(/-?\d+/)?.[0] || '0', 10) : 0;
        });
        return Math.max(...ratings);
    }

    /**
     * Processes each tbody in the results table to add the "Difference" column.
     * @param tbody
     */
    #processTbody(tbody) {
        const rows = tbody.querySelectorAll('tr');
        if (rows.length === 0) return;

        const headerRow = rows[0];
        const ratingIndex = this.#insertDifferenceHeader(headerRow);
        if (ratingIndex === -1) return;

        rows.forEach(row => this.#insertDifferenceCell(row));
    }

    /**
     * Inserts the "Difference" header in the results table.
     * @param headerRow
     * @returns {number}
     */
    #insertDifferenceHeader(headerRow) {
        const ths = headerRow.querySelectorAll('th');
        let ratingThIdx = Array.from(ths).findIndex(th => th.classList.contains('rating'));
        if (ratingThIdx === -1) {
            ratingThIdx = Array.from(ths).findIndex(th => th.textContent.includes('Rating'));
        }
        if (ratingThIdx === -1) return -1;

        const diffTh = document.createElement('th');
        diffTh.textContent = 'Difference';
        ths[ratingThIdx].after(diffTh);
        return ratingThIdx;
    }

    /**
     * Inserts a "Difference" cell in each row of the results table.
     * @param row
     */
    #insertDifferenceCell(row) {
        const ratingTd = row.querySelector('td.rating') || row.querySelector('td.aircraft');
        const diffTd = document.createElement('td');

        if (row.classList.contains('totals')) {
            const img = ratingTd ? ratingTd.querySelector('img') : null;
            let rating = 0;
            if (img) {
                const title = img.getAttribute('title');
                rating = title ? parseInt(title.match(/-?\d+/)?.[0] || '0', 10) : 0;
            }
            diffTd.textContent = this.#maxRating - rating;
        } else {
            diffTd.textContent = '';
        }

        if (ratingTd) {
            ratingTd.after(diffTd);
        }
    }

}

new OnlineReservationSystem().init();
