"use strict";
(() => {
//MAIN
//Global vars
var settings: Record<string, unknown>;
var server: string;
var airline: AESModel.Airline;
let loadedSalaryTargets: Record<string,number> | null = null;
let salaryBatchRunning = false;
var personnelNotifications: Notifications | undefined;
const PERSONNEL_MANAGEMENT_SCRIPT_ENABLED = AES.runContentScript("content_personnelManagement", function() {
    chrome.storage.local.get(['settings'], function(result) {
        AES.tryRun("content_personnelManagement", function() {
            server = AES.getServerName();
            airline = AES.getAirline();
            settings = AES.isRecord(result.settings) ? result.settings : {};
            ensurePersonnelManagementSettings(settings);
            AES.updateSettings(function(currentSettings) {
                ensurePersonnelManagementSettings(currentSettings);
            }, function(updatedSettings) {
                settings = updatedSettings;
                AES.waitForElement(getPersonnelManagementHeading, function() {
                    displayPersonnelManagement();
                }, {
                    scriptName: "content_personnelManagement",
                    errorMessage: "Personnel management insertion target h1 was not found"
                });
            });
        });
    });
});

if (PERSONNEL_MANAGEMENT_SCRIPT_ENABLED) {
    AES.whenPageOwnershipLost(function() {
        $('#aes-personnel-management-root').remove();
    });
}

function displayPersonnelManagement() {
    loadedSalaryTargets = getSalaryTargets(true);
    let input = $('<input type="text" id="aes-input-personnelManagement-value" class="form-control number aes-personnel-management-value" inputmode="numeric">').val(ensurePersonnelManagementSettings(settings).value);

    let option = [];
    option.push('<option value="absolute">AS$</option>');
    option.push('<option value="perc">%</option>');
    let select = $('<select id="aes-select-personnelManagement-type" class="form-control aes-personnel-management-type"></select>').append(...option);
    select.val(ensurePersonnelManagementSettings(settings).type);

    let btn = $(AESI18n.html('<button type="button" class="btn btn-default aes-personnel-management-apply">Apply salaries</button>'));
    let lastUpdate = $('<span id="aes-personnel-management-last-update" class="aes-personnel-management-last-update" role="status"></span>').text(AESI18n.t('No previous update'));

    let controls = $('<div class="form-inline aes-personnel-management-controls"></div>').append(
        $('<div class="form-group aes-personnel-management-control"></div>').append(
            $('<label class="control-label" for="aes-input-personnelManagement-value"></label>').text(AESI18n.t('Value')),
            input
        ),
        $('<div class="form-group aes-personnel-management-control"></div>').append(
            $('<label class="control-label" for="aes-select-personnelManagement-type"></label>').text(AESI18n.t('Type')),
            select
        ),
        $('<div class="form-group aes-personnel-management-action"></div>').append(btn)
    );

    let panel = $('<div class="as-panel aes-personnel-management-panel"></div>').append(controls, lastUpdate);

    //Final
    let mainDiv = getPersonnelManagementHeading();
    let root = $('<div id="aes-personnel-management-root"></div>').append(AESI18n.html('<h3>AES Personnel Management</h3>'), panel);
    AES.markOwnedElements(root);
    if (!mainDiv.length) {
        throw new Error(AESI18n.t("Personnel management insertion target h1 was not found"));
    }
    getPersonnelManagementInsertionTarget(mainDiv).after(root);

    //actions
    select.change(function() {
        ensurePersonnelManagementSettings(settings).type = select.val() === "perc" ? "perc" : "absolute";
        AES.updateSettings(function(currentSettings) {
            ensurePersonnelManagementSettings(currentSettings).type = ensurePersonnelManagementSettings(settings).type;
        }, function(updatedSettings) {
            settings = updatedSettings;
        });
    });
    input.on('input change', function() {
        ensurePersonnelManagementSettings(settings).value = AES.cleanInteger(input.val());
    });
    input.blur(function() {
        input.val(ensurePersonnelManagementSettings(settings).value);
        AES.updateSettings(function(currentSettings) {
            ensurePersonnelManagementSettings(currentSettings).value = ensurePersonnelManagementSettings(settings).value;
        }, function(updatedSettings) {
            settings = updatedSettings;
        });
    });

    btn.click(function() {
        ensurePersonnelManagementSettings(settings).type = select.val() === "perc" ? "perc" : "absolute";
        ensurePersonnelManagementSettings(settings).value = AES.cleanInteger(input.val());
        input.val(ensurePersonnelManagementSettings(settings).value);
        setPersonnelManagementBusy(btn, true);
        AES.updateSettings(function(currentSettings) {
            let personnelSettings = ensurePersonnelManagementSettings(currentSettings);
            personnelSettings.type = ensurePersonnelManagementSettings(settings).type;
            personnelSettings.value = ensurePersonnelManagementSettings(settings).value;
            personnelSettings.auto = 1;
            personnelSettings.alreadyUpdated = [];
        }, function(updatedSettings) {
            settings = updatedSettings;
            salaryUpdate({ actionButton: btn });
        });
    });

    //Automation
    if (ensurePersonnelManagementSettings(settings).auto) {
        setPersonnelManagementBusy(btn, true);
        salaryUpdate({ actionButton: btn });
    }

    //Previous data
    let key = server + airline.id + "personnelManagement";
    chrome.storage.local.get([key], function(result) {
        if (result[key]) {
            void confirmSalaryUpdate(key, result[key]);
            setPersonnelLastUpdateText(lastUpdate, result[key]);
        } else {
            lastUpdate.text(AESI18n.t('No previous update'));
        }
    });
}

function salaryUpdate(options: AESModel.SalaryUpdateOptions = {}) {
    options = options || {};
    AES.updateSettings(function(currentSettings) {
        let personnelSettings = ensurePersonnelManagementSettings(currentSettings);
        personnelSettings.auto = 1;
        personnelSettings.alreadyUpdated = [];
    }, function(updatedSettings) {
        settings = updatedSettings;
        let value = ensurePersonnelManagementSettings(settings).value;
        let type = ensurePersonnelManagementSettings(settings).type;
        let updatedRows = 0;
        let salaryButtons: JQuery[] = [];
        const staffTableInfo = getStaffSalaryTableInfo();

        if (!staffTableInfo) {
            failSalaryUpdate(AESI18n.t("Salary table not found. AES could not locate the Employee Overview salary table."), options);
            return;
        }

        loadedSalaryTargets = getSalaryTargets(true);
        const rows = staffTableInfo.table.find('tbody tr').toArray();

        for (const row of rows) {
            const $row = $(row);

            const salaryForm = $row.find('form input[name="action"][value="salary"]').closest('form');
            const salaryInput = salaryForm.find('input[name="amount"]').first();
            if (!salaryInput.length) continue;

            const salary = AES.cleanInteger((salaryInput[0] as HTMLInputElement).defaultValue);

            let averageCell = $row.children('td, th').eq(staffTableInfo.countryAverageIndex);
            if (!averageCell.length || !averageCell.text().trim()) continue;

            let averageText = averageCell.text().replace(/\(.*?\)/g, '').trim();
            const average = AES.cleanInteger(averageText);
            const salaryBtn = salaryForm.find('.input-group-btn input[type="submit"], button[type="submit"]').first();

            let newSalary = salary;
            if (type === 'absolute') {
                newSalary = average + value;
            } else if (type === 'perc') {
                newSalary = Math.round(average * (1 + value * 0.01));
            }

            if (newSalary !== salary) {
                salaryInput.val(newSalary).trigger('input').trigger('change');
                if (salaryBtn.length) {
                    salaryButtons.push(salaryBtn);
                }
                updatedRows++;
            }
        }

        if (updatedRows > 0 && !salaryButtons.length) {
            failSalaryUpdate(AESI18n.t("Salary buttons not found. AES could not submit the calculated salary changes."), options);
            return;
        }

        finishSalaryUpdate(updatedRows
            ? null
            : 'All salaries are already at the target level.', options, updatedRows > 0);
    });
}

/** Chrome storage may reorder object keys; compare journal contents, not JSON order. */
function salaryJournalMatches(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
            left.every((value, index) => salaryJournalMatches(value, right[index]));
    }
    if (!AES.isRecord(left) || !AES.isRecord(right)) return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key =>
        Object.hasOwn(right, key) && salaryJournalMatches(left[key], right[key]));
}

/** Native POST forms can be processed without navigating after each position. */
function canSubmitSalaryBatch(rows: ReturnType<typeof getSalaryRows>) {
    return !!rows && [...rows.values()].every(({form}) => {
        const url = new URL(form.getAttribute('action') || location.href, location.href);
        return form.method.toLowerCase() === 'post' && url.origin === location.origin &&
            url.pathname === '/action/enterprise/staffOverview' && !url.search && !url.hash;
    });
}

async function submitSalaryBatch(key: string, value: Record<string,unknown>, initialRows: NonNullable<ReturnType<typeof getSalaryRows>>) {
    if (salaryBatchRunning || !AES.isRecord(value.pending) || !AES.isRecord(value.pending.targets)) return;
    salaryBatchRunning = true;
    const expected = value.pending.targets;
    const currentPage = AESRead.context();
    const context = AES.observeContext(currentPage);
    const controller = new AbortController();
    const leave = () => controller.abort();
    window.addEventListener('pagehide', leave, {once:true});
    const stopNativeSubmit = (event: Event) => {
        if ([...initialRows.values()].some(row => row.form === event.target)) {
            event.preventDefault();event.stopImmediatePropagation();
        }
    };
    document.addEventListener('submit',stopNativeSubmit,true);
    const action = $('.aes-personnel-management-apply');
    setPersonnelManagementBusy(action,true);
    let journal = value;
    let rows = initialRows;
    const fail = () => new Error(AESI18n.t('Salary submission awaiting confirmation. Reload to check.'));
    try {
        while (true) {
            if (!currentPage() || controller.signal.aborted) throw fail();
            const actual = Object.fromEntries([...rows].map(([id,row]) => [id,AES.cleanInteger(row.input.defaultValue)]));
            if (Object.keys(expected).some(id => !rows.has(id))) throw fail();
            const next = [...rows].find(([id]) => expected[id] !== actual[id]);
            if (!next) {
                await confirmSalaryUpdate(key,journal,actual);
                const saved = (await chrome.storage.local.get(key))[key];
                if (currentPage() && AES.isRecord(saved) && !saved.pending) location.reload();
                return;
            }
            if (!canSubmitSalaryBatch(rows)) throw fail();
            const form = next[1].form;
            const ids = [...rows].filter(([,row]) => row.form === form).map(([id]) => id);
            const button = form.querySelector<HTMLButtonElement | HTMLInputElement>('button[type="submit"], input[type="submit"]');
            if (!button) throw fail();
            const stored = (await chrome.storage.local.get(key))[key];
            if (!currentPage() || !AES.isRecord(stored) || !salaryJournalMatches(stored.pending,journal.pending)) throw fail();
            const pending = journal.pending as Record<string,unknown>;
            const notBefore = typeof pending.notBefore === 'number' ? pending.notBefore : 0;
            if (notBefore > Date.now()) await AES.sleep(notBefore-Date.now());
            if (!currentPage() || controller.signal.aborted) throw fail();
            journal = {...stored,pending:{...pending,inFlight:ids}};
            await chrome.storage.local.set({[key]:journal});
            if (!currentPage() || controller.signal.aborted) throw fail();
            const body = new URLSearchParams();
            for (const [name,field] of new FormData(form,button)) {
                if (typeof field !== 'string') throw fail();
                body.append(name,field);
            }
            // Each native salary form has one amount field and a stable job ID.
            const amount = expected[next[0]];
            if (ids.length !== 1 || typeof amount !== 'number' || !Number.isFinite(amount)) throw fail();
            body.set('amount',String(amount));
            const completed = Object.keys(expected).filter(id => actual[id] === expected[id]).length;
            $('#aes-personnel-management-last-update').text(AESI18n.t('Updating...')+' '+completed+'/'+Object.keys(expected).length);
            const response = await fetch(new URL(form.getAttribute('action') || location.href,location.href), {
                method:'POST',credentials:'same-origin',body,
                signal:AbortSignal.any([controller.signal,context.signal,AbortSignal.timeout(20000)])
            });
            const returned = new URL(response.url);
            if (!response.ok || returned.origin !== location.origin || returned.pathname !== '/action/enterprise/staffOverview') throw fail();
            const doc = new DOMParser().parseFromString(await response.text(),'text/html');
            if (!currentPage() || controller.signal.aborted || String(AESRead.frontend(doc).fixedEnterpriseId) !== String(airline.id)) throw fail();
            const received = getSalaryRows(doc);
            if (!received || !ids.every(id => received.has(id) && AES.cleanInteger(received.get(id)!.input.defaultValue) === expected[id])) throw fail();
            const latest = (await chrome.storage.local.get(key))[key];
            if (!currentPage() || !AES.isRecord(latest) || !salaryJournalMatches(latest.pending,journal.pending)) throw fail();
            rows = received;
            // Pace dispatches after the response, and keep fresh returned forms.
            journal = {...journal,pending:{...(journal.pending as Record<string,unknown>),notBefore:Date.now()+50+Math.floor(Math.random()*21)}};
            await chrome.storage.local.set({[key]:journal});
        }
    } catch (error) {
        if (currentPage() && !controller.signal.aborted) updatePersonnelLastUpdate(journal);
        throw error;
    } finally {
        salaryBatchRunning = false;
        context.dispose();window.removeEventListener('pagehide',leave);
        document.removeEventListener('submit',stopNativeSubmit,true);
        setPersonnelManagementBusy(action,false);
    }
}

/** Journal one form before dispatch. A new page or replaced form confirms its response. */
async function submitSalaryChanges(key: string, value: Record<string,unknown>, actual: Record<string,number>) {
    if (!AES.isRecord(value.pending) || !AES.isRecord(value.pending.targets)) return;
    const expected = value.pending.targets;
    const rows = getSalaryRows();
    if (!rows || Object.keys(expected).some(id => !rows.has(id))) throw new Error(AESI18n.t("Salary rows could not be identified."));
    if (canSubmitSalaryBatch(rows)) return submitSalaryBatch(key,value,rows!);
    const next = [...rows].find(([id]) => expected[id] !== actual[id]);
    if (!next) return;
    const form = next[1].form;
    const inFlight = [...rows].filter(([,row]) => row.form === form).map(([id]) => id);
    const button = form.querySelector<HTMLButtonElement | HTMLInputElement>('button[type="submit"], input[type="submit"]');
    if (!button) throw new Error(AESI18n.t("Salary buttons not found. AES could not submit the calculated salary changes."));
    const current = (await chrome.storage.local.get(key))[key];
    if (!AES.isPageOwner() || !AES.isRecord(current) || !salaryJournalMatches(current.pending, value.pending)) {
        throw new Error(AESI18n.t("The page changed."));
    }
    const notBefore = typeof value.pending.notBefore === 'number' ? value.pending.notBefore : 0;
    if (notBefore > Date.now()) await AES.sleep(notBefore-Date.now());
    if (!AES.isPageOwner() || !form.isConnected) return;
    const data = {...current,pending:{...value.pending,inFlight,notBefore:Date.now()+50+Math.floor(Math.random()*21)}};
    await chrome.storage.local.set({[key]:data});
    if (!AES.isPageOwner() || !form.isConnected) return;
    for (const id of inFlight) {
        const amount = expected[id];
        if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error(AESI18n.t("Salary rows could not be identified."));
        $(rows.get(id)!.input).val(amount).trigger('input').trigger('change');
    }
    const action = $('.aes-personnel-management-apply');
    setPersonnelManagementBusy(action,true);
    $('#aes-personnel-management-last-update').text(AESI18n.t("Updating..."));
    const context = AES.observeContext(() => AES.isPageOwner());
    try {
        // Editing .value is not confirmation. Accept replacement of the submitted
        // controls or a server-rendered default value update, including in-place AJAX.
        const response = AES.waitForCondition(() => {
            if (!form.isConnected) return true;
            const currentRows = getSalaryRows();
            return inFlight.every(id => {
                const before = rows.get(id)!;
                const after = currentRows?.get(id);
                return !!after && (after.input !== before.input ||
                    AES.cleanInteger(after.input.defaultValue) === expected[id]);
            });
        },15000,context.signal);
        button.click();
        if (!await response) throw new Error(AESI18n.t('Salary submission awaiting confirmation. Reload to check.'));
        const received = getSalaryTargets(true);
        if (!received || !inFlight.every(id => received[id] === expected[id])) {
            throw new Error(AESI18n.t('Salary submission awaiting confirmation. Reload to check.'));
        }
        await confirmSalaryUpdate(key,data,received);
    } catch(error) {
        if (!context.signal.aborted) {
            updatePersonnelLastUpdate(data);
            throw error;
        }
    } finally {
        context.dispose();
        setPersonnelManagementBusy(action,false);
    }
}

function getStaffSalaryTableInfo() {
    const tables = getStaffSalaryTableCandidates();

    for (const table of tables) {
        const tableInfo = completeStaffSalaryTableInfo($(table), getTableHeaderIndexes($(table)));
        if (
            tableInfo.salaryInputIndex !== undefined &&
            tableInfo.countryAverageIndex !== undefined
        ) {
            return {
                table: $(table),
                salaryInputIndex: tableInfo.salaryInputIndex,
                countryAverageIndex: tableInfo.countryAverageIndex
            };
        }
    }

    return null;
}

function getStaffSalaryTableCandidates() {
    const tables: HTMLElement[] = [];
    const addTable = function(table: HTMLElement | undefined) {
        if (table && tables.indexOf(table) === -1) {
            tables.push(table);
        }
    };

    $('form input[name="action"][value="salary"]').closest('form').each(function() {
        addTable($(this).closest('table')[0]);
    });

    getPersonnelManagementContentRoot().find('table').each(function() {
        addTable(this);
    });

    return tables.filter(function(table) {
        return $(table).find('form input[name="action"][value="salary"]').length > 0;
    });
}

function getTableHeaderIndexes(table: JQuery): AESModel.SalaryColumnIndexes {
    const indexes: AESModel.SalaryColumnIndexes = {};
    const grid: Array<Array<string | boolean>> = [];

    table.find('thead tr').each(function(rowIndex) {
        grid[rowIndex] = grid[rowIndex] || [];
        let columnIndex = 0;

        $(this).children('th, td').each(function() {
            const header = $(this);
            const title = normalizePersonnelHeaderText(header.text());
            const colspan = Math.max(parseInt(header.attr('colspan') || '1', 10), 1);
            const rowspan = Math.max(parseInt(header.attr('rowspan') || '1', 10), 1);

            while (grid[rowIndex][columnIndex]) {
                columnIndex++;
            }

            for (let rowOffset = 0; rowOffset < rowspan; rowOffset++) {
                grid[rowIndex + rowOffset] = grid[rowIndex + rowOffset] || [];
                for (let colOffset = 0; colOffset < colspan; colOffset++) {
                    grid[rowIndex + rowOffset][columnIndex + colOffset] = title || true;
                }
            }

            if (isSalaryInputHeader(title)) {
                indexes.salaryInputIndex = columnIndex;
            }
            if (isCountryAverageHeader(title)) {
                indexes.countryAverageIndex = columnIndex;
            }

            columnIndex += colspan;
        });
    });

    return indexes;
}

function completeStaffSalaryTableInfo(table: JQuery, tableInfo: AESModel.SalaryColumnIndexes) {
    tableInfo = tableInfo || {};
    const salaryForm = table.find('form input[name="action"][value="salary"]').closest('form').first();
    const salaryCell = salaryForm.closest('td, th');
    const salaryRow = salaryCell.closest('tr');
    const salaryCellIndex = salaryRow.children('td, th').index(salaryCell[0]);

    if (salaryCellIndex >= 0 && tableInfo.salaryInputIndex === undefined) {
        tableInfo.salaryInputIndex = salaryCellIndex;
    }

    if (salaryCellIndex >= 0 && tableInfo.countryAverageIndex === undefined) {
        const adjacentCell = salaryRow.children('td, th').eq(salaryCellIndex + 1);
        if (isLikelyCountryAverageCell(adjacentCell)) {
            tableInfo.countryAverageIndex = salaryCellIndex + 1;
        }
    }

    return tableInfo;
}

function normalizePersonnelHeaderText(text: unknown) {
    return String(text || '')
        .replace(/[’`´]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function normalizePersonnelHeaderKey(text: unknown) {
    return normalizePersonnelHeaderText(text).replace(/[^a-z]+/g, ' ').trim();
}

function isSalaryInputHeader(text: unknown) {
    const key = normalizePersonnelHeaderKey(text);
    return key === 'next week s salary' || key === 'next weeks salary';
}

function isCountryAverageHeader(text: unknown) {
    return normalizePersonnelHeaderKey(text) === 'country average';
}

function isLikelyCountryAverageCell(cell: JQuery) {
    const text = cell.text().trim();
    return !!text && /\d/.test(text) && /AS\$/i.test(text) && !cell.find('form').length;
}

function getPersonnelManagementHeading() {
    const heading = $('h1').filter(function() {
        return normalizePersonnelHeaderText($(this).text()) === 'employee overview';
    }).first();

    if (heading.length) {
        return heading;
    }

    return $('.container-fluid:eq(2) h1').first();
}

function getPersonnelManagementContentRoot() {
    const heading = getPersonnelManagementHeading();
    const root = heading.closest('.container-fluid');
    return root.length ? root : $('.container-fluid:eq(2)');
}

function getPersonnelManagementInsertionTarget(heading: JQuery) {
    const feedbackPanel = heading.nextAll('.feedbackPanel').first();
    const firstNativePanel = heading.nextAll('.as-panel').first();

    if (feedbackPanel.length && (!firstNativePanel.length || feedbackPanel.index() < firstNativePanel.index())) {
        return feedbackPanel;
    }

    return heading;
}

function getPersonnelNotifications() {
    if (!personnelNotifications && typeof Notifications === 'function') {
        personnelNotifications = new Notifications();
    }
    return personnelNotifications;
}

function showPersonnelNotification(message: string, type?: AESModel.NotificationType, duration?: number) {
    const notifications = getPersonnelNotifications();
    if (notifications) {
        notifications.add(message, { type: type || 'success', duration: duration });
        return;
    }

    if (type === 'error') {
        console.error('[AES Personnel Management] ' + message);
        return;
    }

    console.info('[AES Personnel Management] ' + message);
}

function setPersonnelManagementBusy(button: JQuery | undefined, busy: boolean) {
    if (button && button.length) {
        button.prop('disabled', !!busy);
    }
}

function setPersonnelLastUpdateText(target: JQuery, data: unknown) {
    target.text(formatPersonnelLastUpdate(data));
}

function updatePersonnelLastUpdate(data: unknown) {
    setPersonnelLastUpdateText($('#aes-personnel-management-last-update'), data);
}

function formatPersonnelLastUpdate(data: unknown) {
    if (AES.isRecord(data) && data.pending) return AESI18n.t('Salary submission awaiting confirmation. Reload to check.');
    if (!AES.isRecord(data) || typeof data.date !== "string" || !data.date) {
        return AESI18n.t('No previous update');
    }

    return AESI18n.t("Last update: {0}{1}", {"0": AES.formatDateString(data.date), "1": (data.time ? ' ' + data.time : '')});
}

function failSalaryUpdate(message: string, options: AESModel.SalaryUpdateOptions = {}) {
    options = options || {};
    AES.updateSettings(function(currentSettings) {
        ensurePersonnelManagementSettings(currentSettings).auto = 0;
    }, function(finalSettings) {
        settings = finalSettings;
        setPersonnelManagementBusy(options.actionButton, false);
        showPersonnelNotification(message, 'error', 8000);
    });
}

/** Stable row identities, independent of Wicket's changing form action URLs. */
function getSalaryRows(doc: Document = document) {
    const rows = new Map<string,{form:HTMLFormElement;input:HTMLInputElement}>();
    const root = doc === document ? getStaffSalaryTableInfo()?.table[0] : doc;
    if (!root) return null;
    for (const row of root.querySelectorAll('tbody tr')) {
        const form = $(row).find('input[name="action"][value="salary"]').closest('form');
        const input = form.find('input[name="amount"]')[0] as HTMLInputElement | undefined;
        if (!input) continue;
        const hidden = form.find('input[type="hidden"]').toArray().map(element => {
            const field = element as HTMLInputElement;
            return [field.name,field.value];
        }).sort((a,b) => a[0].localeCompare(b[0]));
        const key = JSON.stringify([$(row).children('td,th').first().text().trim(),hidden]);
        if (rows.has(key)) return null;
        rows.set(key,{form:form[0] as HTMLFormElement,input});
    }
    return rows.size ? rows : null;
}

function getSalaryTargets(serverValues = false): Record<string,number> | null {
    const rows = getSalaryRows();
    return rows ? Object.fromEntries([...rows].map(([id,row]) => [id,AES.cleanInteger(serverValues ? row.input.defaultValue : row.input.value)])) : null;
}

async function confirmSalaryUpdate(key: string, value: unknown, actual = loadedSalaryTargets) {
    if (!AES.isRecord(value) || !AES.isRecord(value.pending) || !AES.isRecord(value.pending.targets)) return;
    const expected = value.pending.targets;
    if (!actual || !Object.keys(expected).length) return;
    loadedSalaryTargets = actual;
    if (!Object.entries(expected).every(([id,amount]) => actual[id] === amount)) {
        // Only resume when the previously submitted form has been confirmed by the server.
        const submitted = value.pending.inFlight;
        if (Array.isArray(submitted) && submitted.length && submitted.every(id => typeof id === 'string' && id in expected && actual[id] === expected[id])) {
            try {await submitSalaryChanges(key,value,actual);}
            catch(error) {showPersonnelNotification(AESI18n.t("Could not confirm salary update: {0}", {"0": String(error)}),'error');}
        }
        return;
    }
    try {
        const current = (await chrome.storage.local.get(key))[key];
        if (!AES.isPageOwner() || !AES.isRecord(current) || !salaryJournalMatches(current.pending, value.pending)) return;
        const today = AES.getServerDate();
        const confirmed: Record<string,unknown> = {...current,date:today.date,time:today.time};
        delete confirmed.pending;
        await chrome.storage.local.set({[key]:confirmed});
        if (AES.isPageOwner()) updatePersonnelLastUpdate(confirmed);
    } catch(error) {showPersonnelNotification(AESI18n.t("Could not confirm salary update: {0}", {"0": String(error)}),'error');}
}

function finishSalaryUpdate(message: string | null, options: AESModel.SalaryUpdateOptions = {}, submit = false) {
    options = options || {};
    AES.updateSettings(function(currentSettings) {
        ensurePersonnelManagementSettings(currentSettings).auto = 0;
    }, function(finalSettings) {
        settings = finalSettings;
        const today = AES.getServerDate();
        const key = server + airline.id + 'personnelManagement';
        void (async () => {
            const stored = await chrome.storage.local.get(key);
            if (!AES.isPageOwner()) return;
            const previous = AES.isRecord(stored[key]) ? stored[key] : {};
            const targets = getSalaryTargets();
            if (submit && !message && !targets) throw new Error(AESI18n.t("Salary rows could not be identified."));
            const data = submit && !message
                ? {...previous, server, airline, type:'personnelManagement', pending:{targets,submittedAt:Date.now()}}
                : {...previous, server, airline, type:'personnelManagement', date:today.date,time:today.time};
            if (message) delete (data as Record<string,unknown>).pending;
            await chrome.storage.local.set({[key]:data});
            if (!AES.isPageOwner()) return;
            updatePersonnelLastUpdate(data);
            if (!submit) setPersonnelManagementBusy(options.actionButton,false);
            if (message) showPersonnelNotification(message,'success');
            if (submit && targets && loadedSalaryTargets) await submitSalaryChanges(key,data,loadedSalaryTargets);
        })().catch(error => failSalaryUpdate(String(error),options));
    });
}

function getDefaultPersonnelManagementSettings(): AESModel.PersonnelSettings {
    return {
        value: 0,
        type: 'absolute',
        auto: 0,
        alreadyUpdated: []
    };
}

function isPersonnelSettings(value: unknown): value is AESModel.PersonnelSettings {
    return AES.isRecord(value) && typeof value.value === "number" && Number.isFinite(value.value) &&
        (value.type === "absolute" || value.type === "perc") &&
        (typeof value.auto === "number" || typeof value.auto === "boolean") && Array.isArray(value.alreadyUpdated);
}

function ensurePersonnelManagementSettings(targetSettings: Record<string, unknown>): AESModel.PersonnelSettings {
    const value = targetSettings.personnelManagement;
    if (isPersonnelSettings(value)) return value;
    const defaults = getDefaultPersonnelManagementSettings();
    const old = AES.isRecord(value) ? value : {};
    const normalized: AESModel.PersonnelSettings = {
        ...old,
        value: typeof old.value === "number" && Number.isFinite(old.value) ? old.value : AES.cleanInteger(old.value ?? defaults.value),
        type: old.type === "perc" ? "perc" : defaults.type,
        auto: typeof old.auto === "number" || typeof old.auto === "boolean" ? old.auto : defaults.auto,
        alreadyUpdated: Array.isArray(old.alreadyUpdated) ? old.alreadyUpdated : defaults.alreadyUpdated
    };
    targetSettings.personnelManagement = normalized;
    return normalized;
}

})();
