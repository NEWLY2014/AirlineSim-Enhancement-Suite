/** Shared logic */
class AES {
    static cloneData<T>(value: T): T {
        return value === undefined ? value : JSON.parse(JSON.stringify(value));
    }

    static async patchRecord(key: string, before: unknown, after: unknown): Promise<unknown> {
        const message = {type:'AES_RECORD_PATCH',key,before:AES.cloneData(before),after:AES.cloneData(after)};
        const href = location.href;
        const current = () => AES.isPageOwner() && location.href === href;
        for (let attempt = 0; attempt < 2; attempt++) {
            if (!current()) throw new Error(AESI18n.t("The page changed."));
            const result = await new Promise<{reply?: unknown; transportError?: string}>(resolve => {
                try {
                    chrome.runtime.sendMessage(message, (reply: unknown) => {
                        const error = chrome.runtime.lastError;
                        resolve(error ? {transportError:error.message || 'Extension connection failed.'} : {reply});
                    });
                } catch (error) {
                    resolve({transportError:error instanceof Error ? error.message : String(error)});
                }
            });
            if (!current()) throw new Error(AESI18n.t("The page changed."));
            if (result.transportError || result.reply === undefined) {
                const error = result.transportError || 'The extension background did not respond.';
                const disconnected = /message (?:port|channel) closed|receiving end does not exist|could not establish connection|extension context invalidated|background did not respond/i.test(error);
                if (!disconnected) throw new Error(error);
                // Record patches are idempotent: a lost acknowledgement may be retried
                // through the same merge queue without bypassing conflict protection.
                if (!attempt) {await AES.sleep(150);continue;}
                throw new Error(AESI18n.t("AES background is unavailable or outdated. Reload AES on chrome://extensions, then reload this game page. {0}", {0: error}));
            }
            if (!AES.isRecord(result.reply) || result.reply.ok !== true) {
                throw new Error(AES.isRecord(result.reply) ? AESI18n.errorMessage(String(result.reply.error)) : AESI18n.t("Storage unavailable."));
            }
            return result.reply.value;
        }
        throw new Error(AESI18n.t("AES background did not respond."));
    }

    /** Validate fields used by fleet pages while retaining legacy/unknown metadata. */
    static isFleetAircraft(value: unknown): value is AESModel.FleetAircraft {
        if (!AES.isRecord(value)) return false;
        if (value.aircraftId !== undefined && value.aircraftId !== null &&
            typeof value.aircraftId !== 'string' && typeof value.aircraftId !== 'number') return false;
        return ['registration', 'fleet', 'hubDetected', 'hubEffective', 'hubOverride', 'hubDetectionSource']
            .every(key => value[key] === undefined || value[key] === null || typeof value[key] === 'string');
    }

    static readFleetRecord(value: unknown): AESModel.FleetRecord | null {
        if (!AES.isRecord(value) || !Array.isArray(value.fleet)) return null;
        return { ...value, fleet: value.fleet.filter(AES.isFleetAircraft) };
    }

    static isAircraftProfit(value: unknown): value is AESModel.AircraftProfit {
        if (!AES.isRecord(value)) return false;
        return ['date', 'time'].every(key => typeof value[key] === 'string') &&
            ['finishedFlights', 'totalFlights', 'profit', 'profitFlights'].every(key =>
                typeof value[key] === 'number' && Number.isFinite(value[key])) &&
            ['hubDetected', 'hubEffective', 'hubOverride'].every(key =>
                value[key] === undefined || value[key] === null || typeof value[key] === 'string');
    }

    static _competitorPageData: AESModel.CompetitorRecord | undefined;
    static _serverClockSource: string | undefined;
    static _serverClockTimestamp = 0;
    static _serverClockPerformance: number | null = null;
    static _serverClockLocalTimestamp = 0;
    static _pageControlInitialized = false;
    static _pageOwner = false;
    static _ownershipLostCallbacks: Array<() => void> = [];
    static _pageControlObserver: MutationObserver | undefined;
    static _contentScriptErrorReporterInstalled = false;
    static _reportedErrors: Record<string, boolean> = {};

    static isRecord(value: unknown): value is Record<string, unknown> {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    static #parseFrontendSettings(value: unknown): AESModel.FrontendSettings {
        if (!AES.isRecord(value)) return {};
        const { fixedEnterpriseId, theme, server, ...extra } = value;
        const result: AESModel.FrontendSettings = { ...extra };
        if (typeof theme === 'string') result.theme = theme;
        if (typeof value.fixedEnterpriseId === 'string' || typeof value.fixedEnterpriseId === 'number') {
            result.fixedEnterpriseId = value.fixedEnterpriseId;
        }
        if (AES.isRecord(value.server) && typeof value.server.time === 'string') {
            result.server = { ...value.server, time: value.server.time };
        }
        return result;
    }

    static #parseAirlineLookup(value: unknown): Record<string, AESModel.StoredAirline> {
        const result: Record<string, AESModel.StoredAirline> = Object.create(null);
        if (!AES.isRecord(value)) return result;
        for (const [key, entry] of Object.entries(value)) {
            if (!AES.isRecord(entry)) continue;
            const airline: AESModel.StoredAirline = { ...entry };
            if (typeof entry.id === 'string' || entry.id === null) airline.id = entry.id;
            else if (typeof entry.id === 'number' && Number.isFinite(entry.id)) airline.id = String(entry.id);
            else delete airline.id;
            if (typeof entry.code === 'string') airline.code = entry.code;
            else delete airline.code;
            result[key] = airline;
        }
        return result;
    }


    // The new header is rendered asynchronously and uses CSS modules. Match the
    // semantic class prefix, never the generated hash or Base UI element IDs.
    static getNavbarAirline() {
        const menu = document.querySelector('#header [role="menubar"]');
        const selector = menu?.parentElement?.querySelector('button[aria-haspopup="menu"]');
        const text = (prefix: string) => Array.from(selector?.querySelectorAll('span') || [])
            .find(element => Array.from(element.classList).some(name => name.startsWith(prefix)))
            ?.textContent.trim() || '';
        return {
            displayName: text('_name_') || $('.as-navbar-main .dropdown > a.name span').first().text().trim() ||
                $('.as-navbar-main .dropdown > a.name').first().text().trim(),
            code: text('_code_')
        };
    }

    static getPageContainer() {
        return document.querySelector('.bootstrap.container-fluid') ||
            document.querySelector('h1')?.closest('.container-fluid') || null;
    }

    static getEnterpriseHeading() {
        const tabs = document.querySelector('.nav-tabs');
        return tabs?.parentElement?.parentElement?.querySelector('h2') || null;
    }

    // Content scripts cannot read page-world globals directly. Parse only JSON
    // from the server's inline assignment; never execute page scripts.
    static getFrontendSettings(): AESModel.FrontendSettings {
        if (globalThis.frontendSettings) return AES.#parseFrontendSettings(globalThis.frontendSettings);
        for (const script of Array.from(document.scripts || [])) {
            const match = (script.textContent || '').match(/(?:window\.)?frontendSettings\s*=\s*(\{[\s\S]*?\})\s*;/);
            if (!match) continue;
            try {
                return AES.#parseFrontendSettings(JSON.parse(match[1]));
            } catch (error) {
                console.warn('[AES] Unable to parse frontendSettings', error);
            }
        }
        return {};
    }

    /**
     * Safely updates extension settings using the latest stored snapshot.
     * @param {function(object): void} mutator
     * @param {function(object): void} callback
     */
    static updateSettings(mutator: (settings: Record<string, unknown>) => void, callback?: (settings: Record<string, unknown>) => void, onError?: (error: Error) => void) {
        const fail = (message: string) => {
            const error = new Error(AESI18n.errorMessage(message));
            AES.reportContentScriptError('settings', error);
            onError?.(error);
        };
        const attempt = (remaining: number) => {
            chrome.storage.local.get(['settings'], function(result) {
                if (chrome.runtime.lastError) { fail(chrome.runtime.lastError.message || 'Unable to read settings.'); return; }
                if (!AES.isPageOwner()) return;
                const current = AES.isRecord(result.settings) ? result.settings : {};
                const expected = JSON.stringify(current);
                const next: Record<string, unknown> = JSON.parse(expected);
                try { mutator(next); } catch (error) { fail(String(error)); return; }
                chrome.runtime.sendMessage({type:'AES_SETTINGS_CAS', expected, next}, (response: unknown) => {
                    if (chrome.runtime.lastError) { fail(chrome.runtime.lastError.message || 'Settings service unavailable.'); return; }
                    if (!AES.isRecord(response) || response.ok !== true) { fail(AES.isRecord(response) ? String(response.error) : 'Settings service unavailable.'); return; }
                    if (response.conflict) {
                        if (remaining > 0) attempt(remaining - 1);
                        else fail('Settings changed repeatedly. Please retry.');
                        return;
                    }
                    if (AES.isPageOwner()) callback?.(next);
                });
            });
        };
        attempt(20);
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
    static getAirline(): AESModel.Airline {
        if (!/\/app\/info\/enterprises\/\d+/.test(window.location.pathname) &&
            !window.location.pathname.startsWith('/app/enterprise/dashboard')) {
            const current = AES.getCurrentAirline();
            if (!current.name) throw new Error(AESI18n.t("Unable to determine airline from the current page"));
            return current;
        }
        const server = AES.getServerName();
        const serverKey = `${server}_airlinesData`;
        let serverAirlinesData: Record<string, AESModel.StoredAirline> = Object.create(null);
        try {
            const saved = JSON.parse(localStorage.getItem(serverKey) || '{}');
            serverAirlinesData = AES.#parseAirlineLookup(saved);
        } catch (error) {
            console.warn('[AES] Ignoring invalid saved airline lookup data.', error);
        }

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
                displayName = AES.getNavbarAirline().displayName;
            }
        }

        const href = $('a[href*="tab=2"]').attr('href') || $('a[href*="enterprises/"]').attr('href');
        const match = window.location.pathname.match(/\/info\/enterprises\/(\d+)/) ||
            href?.match(/enterprises\/(\d+)/) || href?.match(/\.\/(\d+)/);
        const idFromHref = match ? match[1] : null;
        const name = displayName
            ? displayName.replace(/[^A-Za-z0-9]/g, '_')
            : (idFromHref ? `airline_${idFromHref}` : null);

        if (!name) {
            throw new Error(AESI18n.t("Unable to determine airline from the current page"));
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
    static getCurrentAirline(): AESModel.Airline {
        const server = AES.getServerName();
        const serverKey = `${server}_airlinesData`;
        let serverAirlinesData: Record<string, AESModel.StoredAirline> = Object.create(null);
        try {
            const storedAirlinesData = JSON.parse(localStorage.getItem(serverKey) || '{}');
            if (storedAirlinesData && typeof storedAirlinesData === 'object' && !Array.isArray(storedAirlinesData)) {
                serverAirlinesData = AES.#parseAirlineLookup(storedAirlinesData);
            }
        } catch (error) {
            console.warn('[AES] Ignoring invalid saved airline lookup data.', error);
        }
        const navbar = AES.getNavbarAirline();
        const displayName = navbar.displayName;
        const name = displayName ? displayName.replace(/[^A-Za-z0-9]/g, '_') : null;
        const data = name ? serverAirlinesData[name] : null;
        const selectedAirlineId = AES.getFrontendSettings().fixedEnterpriseId ||
            new URL(window.location.href).searchParams.get('select');
        const hasSelectedAirlineId = /^\d+$/.test(String(selectedAirlineId || ''));
        let id = hasSelectedAirlineId ? String(selectedAirlineId) : (data?.id || null);
        let code = navbar.code || data?.code || '';

        if (!hasSelectedAirlineId) {
            const normalizedDisplayName = displayName.replace(/\s+/g, ' ').trim();
            const dashboardLinks = $('.as-navbar-main .dropdown-menu a[href*="select="]');
            let matchingIds: string[] = [];
            dashboardLinks.each(function () {
                const link = $(this);
                const linkName = (link.find('span').first().text().trim() || link.text().trim()).replace(/\s+/g, ' ');
                if (normalizedDisplayName && linkName !== normalizedDisplayName) {
                    return;
                }

                const href = link.attr('href') || '';
                const match = href.match(/select=(\d+)/);
                if (match) {
                    matchingIds.push(match[1]);
                }
            });

            matchingIds = matchingIds.filter(function(candidateId, position, ids) {
                return ids.indexOf(candidateId) === position;
            });
            if (matchingIds.length === 1) {
                id = matchingIds[0];
            }
        }

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
    static getCompetitorMonitoringKey(server: string, ownerAirlineId: string | null, competitorAirlineId: string | null) {
        if (ownerAirlineId) {
            return `${server}${ownerAirlineId}_${competitorAirlineId}competitorMonitoring`;
        }

        return `${server}${competitorAirlineId}competitorMonitoring`;
    }

    // Both enterprise page scripts receive the same record. A delayed read must
    // not replace changes made by the other script since the read was requested.
    static getCompetitorPageData(stored: unknown, server: string, owner: AESModel.Airline, airline: AESModel.Airline): AESModel.CompetitorRecord {
        const key = AES.getCompetitorMonitoringKey(server, owner.id, airline.id);
        if (AES._competitorPageData?.key === key) return AES._competitorPageData;
        const old = AES.isRecord(stored) ? stored : {};
        const data: AESModel.CompetitorRecord = {
            ...old,
            key,
            server,
            ownerId: owner.id,
            ownerAirline: owner,
            id: airline.id,
            type: 'competitorMonitoring',
            tab0: AES.isRecord(old.tab0) ? old.tab0 : {},
            tab2: AES.isRecord(old.tab2) ? old.tab2 : {},
            tracking: typeof old.tracking === 'number' || typeof old.tracking === 'boolean' ? old.tracking : 0,
            autoExtract: typeof old.autoExtract === 'number' || typeof old.autoExtract === 'boolean' ? old.autoExtract : 0
        };
        AES._competitorPageData = data;
        return data;
    }

    /**
     * Returns the storage key for the owner-scoped competitor-monitoring index.
     * @param {string} server
     * @param {string} ownerAirlineId
     * @returns {string}
     */
    static getCompetitorMonitoringIndexKey(server: string, ownerAirlineId: string | null) {
        return `${server}${ownerAirlineId}competitorMonitoringIndex`;
    }

    /**
     * Formats a currency value local standards
     * @param {integer} currency value
     * @param {string} alignment: "right" | "left"
     * @returns {HTMLElement} span with formatted value
     */
    static formatCurrency(value: number, alignment?: "right" | "left") {
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
        currencyEl.innerText = AESI18n.t(" AS$")

        container.className = containerClasses
        container.append(indicatorEl, valueEl, currencyEl)

        return container
    }

    /**
     * Formats a date string to human readable format
     * @param {string} "20240524"
     * @returns {string} "2024-05-24" | "error: invalid format for AES.formatDateString"
     */
    static formatDateString(date: string | null | undefined) {
        if (!date) {
            return
        }

        const correctLength = date.length === 8
        const isInteger = Number.isInteger(parseInt(String(date)))
        let result = AESI18n.t('Invalid date format')

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
    static formatDateStringWeek(date: string | number) {
        const correctLength = date.toString().length === 6
        const isInteger = Number.isInteger(parseInt(String(date)))
        let result = AESI18n.t('Invalid date format')

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
        const settingsDate = AES.#getServerDateFromFrontendSettings()
        if (settingsDate) {
            return settingsDate
        }

        throw new Error(AESI18n.t("Unable to read frontendSettings.server.time. Check AES.getServerDate()"))
    }

    static #getServerDateFromFrontendSettings() {
        const settingsTime = AES.#getFrontendSettingsServerTime()
        if (!settingsTime) {
            return null
        }

        const parsedTime = new Date(settingsTime)
        if (isNaN(parsedTime.getTime())) {
            return null
        }

        if (AES._serverClockSource !== settingsTime) {
            AES._serverClockSource = settingsTime
            AES._serverClockTimestamp = parsedTime.getTime()
            AES._serverClockPerformance = typeof performance !== "undefined" && typeof performance.now === "function"
                ? performance.now()
                : null
            AES._serverClockLocalTimestamp = Date.now()
        }

        const elapsed = AES._serverClockPerformance != null && typeof performance !== "undefined" && typeof performance.now === "function"
            ? performance.now() - AES._serverClockPerformance
            : Date.now() - AES._serverClockLocalTimestamp
        const currentServerTime = new Date(AES._serverClockTimestamp + Math.max(0, elapsed))
        const year = String(currentServerTime.getUTCFullYear())
        const month = String(currentServerTime.getUTCMonth() + 1).padStart(2, "0")
        const day = String(currentServerTime.getUTCDate()).padStart(2, "0")
        const hours = String(currentServerTime.getUTCHours()).padStart(2, "0")
        const minutes = String(currentServerTime.getUTCMinutes()).padStart(2, "0")

        return {
            date: `${year}${month}${day}`,
            time: `${hours}:${minutes} UTC`
        }
    }

    static #getFrontendSettingsServerTime() {
        const time = AES.getFrontendSettings().server?.time;
        return time ? String(time) : null;
    }

    /**
     * Returns the difference between dates in days
     * @param {array} ["20240520", "20240524"]
     * @returns {integer} 4
     */
    static getDateDiff(dates: readonly [string, string]) {
        let dateA = new Date(`${this.formatDateString(dates[0])}T12:00:00Z`)
        let dateB = new Date(`${this.formatDateString(dates[1])}T12:00:00Z`)
        let result = Math.round((dateA.getTime() - dateB.getTime())/(1000 * 60 * 60 * 24))

        return result
    }

    /**
     * Cleans a string of punctuation to returns an integer
     * @param {string} value - "-2,000 AS$" | "2.000 AS$" | "256"
     * @returns {integer} -2000 | 2000 | 256
     */
    static cleanInteger(value: unknown) {
        const text = String(value).trim().replace(/[,.\s]|AS\$/g, '');
        const cleaned = text.replace(/[^\d-]/g, '');
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? 0 : parsed;
    }

    // Sleep for some time
    static sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async yieldToPage(): Promise<void> {
        // Bulk extraction/comparison should also let normal page tasks and painting run.
        const scheduler = (globalThis as typeof globalThis & {scheduler?: {
            postTask?: (callback: () => void, options: {priority: 'background'}) => Promise<void>;
            yield?: () => Promise<void>;
        }}).scheduler;
        if (typeof scheduler?.postTask === 'function') await scheduler.postTask(() => {}, {priority:'background'});
        else if (typeof scheduler?.yield === 'function') await scheduler.yield();
        else await AES.sleep(0);
    }

    /** Observe a state transition; timers only bound the wait or a stability window. */
    static waitForCondition(check: () => unknown, timeoutMs = 5000, signal?: AbortSignal, stableMs = 0): Promise<boolean> {
        return new Promise((resolve, reject) => {
            let finished = false, stableSince: number | undefined;
            let deadline = 0, settle = 0;
            const events = ['input', 'change', 'aes-planner-response', 'visibilitychange'];
            const observer = new MutationObserver(() => inspect());
            const finish = (value: boolean, error?: unknown) => {
                if (finished) return;
                finished = true;
                observer.disconnect();
                window.clearTimeout(deadline); window.clearTimeout(settle);
                events.forEach(name => document.removeEventListener(name, changed));
                signal?.removeEventListener('abort', abort);
                if (error !== undefined) reject(error); else resolve(value);
            };
            const inspect = () => {
                if (finished) return;
                try {
                    signal?.throwIfAborted();
                    if (!check()) { stableSince = undefined; window.clearTimeout(settle); return; }
                    stableSince ??= performance.now();
                    const remaining = stableMs - (performance.now() - stableSince);
                    if (remaining <= 0) finish(true);
                    else { window.clearTimeout(settle); settle = window.setTimeout(inspect, remaining); }
                } catch (error) { finish(false, error); }
            };
            const changed = () => inspect();
            const abort = () => finish(false, signal?.reason);
            observer.observe(document.documentElement, {childList:true, subtree:true, attributes:true, characterData:true});
            events.forEach(name => document.addEventListener(name, changed));
            signal?.addEventListener('abort', abort, {once:true});
            deadline = window.setTimeout(() => { inspect(); if (!finished) finish(false); }, timeoutMs);
            inspect();
        });
    }

    /** Cancellation follows the page lifecycle and observable context changes. */
    static observeContext(current: () => boolean) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        const check = () => { if (!current()) abort(); };
        const observer = new MutationObserver(check);
        const unsubscribe = AES.whenPageOwnershipLost(abort);
        observer.observe(document.documentElement, {childList:true, subtree:true, attributes:true});
        window.addEventListener('pagehide', abort);
        window.addEventListener('popstate', check);
        window.addEventListener('hashchange', check);
        check();
        return {signal:controller.signal, dispose:() => {
            observer.disconnect(); unsubscribe?.();
            window.removeEventListener('pagehide', abort);
            window.removeEventListener('popstate', check);
            window.removeEventListener('hashchange', check);
        }};
    }

    /**
     * Runs a callback once a DOM target exists, including targets added by
     * AirlineSim's asynchronous page rendering.
     * @param {string|string[]|function(): HTMLElement|NodeList|Array|jQuery|boolean} target
     * @param {function(HTMLElement|NodeList|Array|jQuery|boolean): void|Promise<void>} callback
     * @param {object} options
     * @returns {{disconnect: function(): void}}
     */
    static waitForElement(target: AESModel.WaitTarget, callback: (target: AESModel.WaitResult) => void | Promise<void>, options: AESModel.WaitOptions = {}) {
        options = options || {};
        const scriptName = options.scriptName || "content script";
        const debounce = typeof options.debounce === "number" ? options.debounce : 100;
        const timeout = typeof options.timeout === "number" ? options.timeout : 15000;
        const root = options.root || document.documentElement || document.body;
        let observer: MutationObserver | null = null;
        let refreshTimer = 0;
        let timeoutTimer = 0;
        let finished = false;
        let detachOwnership = () => {};

        const cleanup = function() {
            finished = true;
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            window.clearTimeout(refreshTimer);
            window.clearTimeout(timeoutTimer);
            detachOwnership();
        };

        const tryStart = function() {
            if (finished) {
                return true;
            }

            let foundTarget;
            try {
                foundTarget = AES.#resolveWaitTarget(target);
            } catch (error) {
                cleanup();
                AES.reportContentScriptError(scriptName, error);
                return true;
            }

            if (!AES.#isWaitTargetFound(foundTarget)) {
                return false;
            }

            cleanup();
            AES.tryRun(scriptName, function() {
                return callback(foundTarget);
            });
            return true;
        };

        if (!tryStart()) {
            if (typeof MutationObserver === "function" && root) {
                observer = new MutationObserver(() => { tryStart(); });
                observer.observe(root, { childList: true, subtree: true, attributes: true });
            } else {
                const retry = function() {
                    if (tryStart()) {
                        return;
                    }
                    refreshTimer = window.setTimeout(retry, debounce);
                };
                refreshTimer = window.setTimeout(retry, debounce);
            }

            if (timeout > 0) {
                timeoutTimer = window.setTimeout(function() {
                    if (tryStart()) return;
                    cleanup();
                    if (typeof options.onTimeout === "function") {
                        AES.tryRun(scriptName, options.onTimeout);
                    } else if (options.errorMessage) {
                        AES.reportContentScriptError(scriptName, new Error(options.errorMessage));
                    }
                }, timeout);
            }
        }

        if (!finished) detachOwnership = AES.whenPageOwnershipLost(cleanup) || (() => {});
        return { disconnect: cleanup };
    }

    static #resolveWaitTarget(target: AESModel.WaitTarget) {
        if (typeof target === "function") {
            return target();
        }

        const selectors = Array.isArray(target) ? target : [target];
        for (let i = 0; i < selectors.length; i++) {
            const selector = selectors[i];
            if (!selector) {
                continue;
            }

            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
        }

        return null;
    }

    static #isWaitTargetFound(target: AESModel.WaitResult) {
        if (!target) {
            return false;
        }
        if (typeof target === "boolean") {
            return target;
        }
        if (typeof target === "object" && "length" in target && typeof target.length === "number") {
            return target.length > 0;
        }
        return true;
    }

    static async pageQueueMessage(message: Record<string, unknown>): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({type: 'AES_PAGE_QUEUE', ...message}, (response: unknown) => {
                if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
                if (!AES.isRecord(response) || response.ok !== true) { reject(new Error(AES.isRecord(response) ? AESI18n.errorMessage(String(response.error || 'Page queue failed.')) : AESI18n.t("No queue response."))); return; }
                resolve(response);
            });
        });
    }

    static async queuePage(url: string, kind: 'open' | 'price' | 'navigate' | 'read' = 'open', current: () => boolean = () => AES.isPageOwner()): Promise<{cancel: () => Promise<void>; complete: () => Promise<void>; expires?: number}> {
        const sourceUrl = location.href;
        const valid = () => current() && location.href === sourceUrl;
        if (!valid()) throw new Error(AESI18n.t("The requesting page is no longer current."));
        const id = crypto.randomUUID();
        const cancel = async () => { try { await AES.pageQueueMessage({op:'cancel', id}); } catch {} };
        const complete = async () => { try { await AES.pageQueueMessage({op:'complete', id}); } catch {} };
        let expires: number | undefined;
        const context = AES.observeContext(valid);
        try {
            await new Promise<void>((resolve, reject) => {
                let timer = 0, finished = false, polling = false, notifiedWhilePolling = false;
                let permitExpires: number | undefined;
                const cleanup = () => {
                    window.clearTimeout(timer);
                    chrome.runtime.onMessage.removeListener(notify);
                    context.signal.removeEventListener('abort', abort);
                };
                const finish = (error?: unknown) => {
                    if (finished) return;
                    finished = true; cleanup();
                    if (error) reject(error); else { expires = permitExpires; resolve(); }
                };
                const abort = () => finish(new Error(AESI18n.t("Page changed while waiting in the queue.")));
                const schedule = (notBefore?: number) => {
                    window.clearTimeout(timer);
                    // Dispatch ready notifications directly; timer throttling must not delay them.
                    if (typeof notBefore === 'number' && notBefore <= Date.now()) { queueMicrotask(check); return; }
                    // Recover a missed message before the server's two-minute client lease ends.
                    timer = window.setTimeout(check, typeof notBefore === 'number' ? notBefore-Date.now() : 60000);
                };
                const check = async () => {
                    if (finished || polling) return;
                    if (!valid()) { abort(); return; }
                    polling = true;
                    try {
                        const result = await AES.pageQueueMessage({op:'poll', id});
                        if (finished) return;
                        if (!valid()) { abort(); return; }
                        if ((kind === 'price' || kind === 'read') && result.state === 'running') {
                            if (typeof result.expires !== 'number' || Date.now() >= result.expires) throw new Error(AESI18n.t("The price submission slot expired. Please retry."));
                            permitExpires = result.expires; finish(); return;
                        }
                        if (result.state === 'done' || (kind !== 'price' && kind !== 'read' && result.state === 'running')) { finish(); return; }
                        schedule(typeof result.notBefore === 'number' ? result.notBefore : undefined);
                    } catch (error) { finish(error); }
                    finally {
                        polling = false;
                        if (notifiedWhilePolling && !finished) { notifiedWhilePolling = false; queueMicrotask(check); }
                    }
                };
                const notify = (message: unknown, sender: chrome.runtime.MessageSender, reply: (response: unknown) => void) => {
                    if (sender.id !== chrome.runtime.id || !AES.isRecord(message) || message.type !== 'AES_PAGE_QUEUE_READY' || message.id !== id || finished) return;
                    reply({ok:true});
                    if (polling) { notifiedWhilePolling = true; return; }
                    schedule(typeof message.notBefore === 'number' ? message.notBefore : undefined);
                };
                chrome.runtime.onMessage.addListener(notify);
                context.signal.addEventListener('abort', abort, {once:true});
                if (context.signal.aborted) { abort(); return; }
                void AES.pageQueueMessage({op:'enqueue', id, url:new URL(url, location.href).href, kind}).then(() => check(), finish);
            });
            return {cancel, complete, expires};
        } catch (error) { await cancel(); throw error; }
        finally { context.dispose(); }
    }

    static async openPagesWithDelay(pages: string[]) {
        for (const url of pages) await AES.queuePage(url);
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
     * Compares AES versions, including prereleases and legacy letter suffixes.
     * @param {string} versionA
     * @param {string} versionB
     * @returns {integer} 1 | 0 | -1
     */
    static compareVersions(versionA: string, versionB: string) {
        function parseVersion(value: string) {
            const match = String(value || "0.0.0").trim().match(/^(\d+)\.(\d+)\.(\d+)([A-Za-z]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/);
            if (!match) {
                return { major: 0, minor: 0, patch: 0, suffix: "", prerelease: "" };
            }

            return {
                major: parseInt(match[1], 10),
                minor: parseInt(match[2], 10),
                patch: parseInt(match[3], 10),
                suffix: (match[4] || "").toLowerCase(),
                prerelease: match[5] || ""
            };
        }

        const a = parseVersion(versionA);
        const b = parseVersion(versionB);
        const numericKeys = ["major", "minor", "patch"] as const;

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
            if (a.prerelease === b.prerelease) return 0;
            if (!a.prerelease) return 1;
            if (!b.prerelease) return -1;
            const left = a.prerelease.split(".");
            const right = b.prerelease.split(".");
            for (let i = 0; i < Math.max(left.length, right.length); i++) {
                if (left[i] === undefined) return -1;
                if (right[i] === undefined) return 1;
                if (left[i] === right[i]) continue;
                const leftNumeric = /^\d+$/.test(left[i]);
                const rightNumeric = /^\d+$/.test(right[i]);
                if (leftNumeric && rightNumeric) {
                    const difference = Number(left[i]) - Number(right[i]);
                    if (difference) return difference > 0 ? 1 : -1;
                    continue;
                }
                if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
                return left[i] > right[i] ? 1 : -1;
            }
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
    static shouldRunContentScript(scriptName: string) {
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
    static runContentScript(scriptName: string, initializer: AESModel.Initializer, options?: { ready?: boolean }) {
        const allowed = AES.shouldRunContentScript(scriptName);
        if (!allowed) {
            return false;
        }

        AES.#installContentScriptErrorReporter(scriptName);

        const run = function() {
            AESI18n.whenReady(()=>{
                // The new React header initially renders an empty enterprise selector.
                // Page tables can already exist at that point; wait before choosing
                // storage keys so the first load never saves under an empty airline.
                if (!scriptName.startsWith('module:') && document.getElementById('header') &&
                    AES.getFrontendSettings().fixedEnterpriseId && !AES.getNavbarAirline().displayName) {
                    AES.waitForElement(() => !!AES.getNavbarAirline().displayName, initializer, {
                        scriptName,
                        errorMessage: 'Current airline header did not finish loading'
                    });
                    return;
                }
                AES.tryRun(scriptName, initializer);
            });
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
    static tryRun(scriptName: string, callback: AESModel.Initializer) {
        try {
            const result = typeof callback === "function" ? callback() : null;
            if (result && typeof result.catch === "function") {
                result.catch(function(error: unknown) {
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
     * @param {unknown} error
     */
    static reportContentScriptError(scriptName: string, error: unknown) {
        const errorMessage = (error instanceof Error || AES.isRecord(error)) && error.message ? String(error.message) : String(error || "Unknown error");
        const message = AESI18n.t("AES {0} error: {1}", {0: scriptName || "content script", 1: AESI18n.errorMessage(errorMessage)});
        console.error(`[AES] ${scriptName || "content script"} failed`, error);

        const key = `${scriptName || ""}:${errorMessage}`;
        AES._reportedErrors = AES._reportedErrors || {};
        if (AES._reportedErrors[key]) {
            return;
        }
        AES._reportedErrors[key] = true;
        AES.writeLog("error", scriptName || "content script", errorMessage, {
            stack: (error instanceof Error || AES.isRecord(error)) && error.stack ? String(error.stack) : "",
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
    static writeLog(level: string, source: string, message: string, details?: object) {
        if (!globalThis.chrome || !chrome.storage || !chrome.storage.local) {
            return;
        }

        const now = new Date();
        const dateKey = AES.#formatLogDate(now);
        const storageKey = `aesLog_${dateKey}`;
        const entry: AESModel.LogEntry = {
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

            const logData = AES.isRecord(result[storageKey])
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
    static whenPageOwnershipLost(callback: () => void) {
        if (typeof callback !== "function") {
            return;
        }
        AES.#ensurePageControlMonitor();
        AES._ownershipLostCallbacks.push(callback);
        return () => { AES._ownershipLostCallbacks = AES._ownershipLostCallbacks.filter(item => item !== callback); };
    }

    /**
     * Marks elements as belonging to this AES instance.
     * @param {HTMLElement|Array|NodeList|jQuery} elements
     */
    static markOwnedElements(elements: Node | ArrayLike<Node | null | undefined> | null | undefined) {
        if (!elements) {
            return;
        }

        const ownOwner = chrome.runtime.id;
        const ownVersion = AES.getVersion();
        const mark = function(element: Node | null | undefined) {
            if (!(element instanceof Element)) return;
            element.setAttribute("data-aes-owner", ownOwner);
            element.setAttribute("data-aes-version", ownVersion);
        };

        if (!(elements instanceof Node)) {
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

    static #getPageControlMarker(createIfMissing: true): HTMLElement;
    static #getPageControlMarker(createIfMissing: boolean): HTMLElement | null;
    static #getPageControlMarker(createIfMissing: boolean): HTMLElement | null {
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

    static #installContentScriptErrorReporter(scriptName: string) {
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

    static #showFallbackError(message: string) {
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
            const target = AES.getPageContainer() || document.body || document.documentElement;
            target.prepend(container);
        }

        window.setTimeout(function() {
            item.remove();
        }, 12000);
    }

    static #formatLogDate(date: Date) {
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
            [...AES._ownershipLostCallbacks].forEach(function(callback) {
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
