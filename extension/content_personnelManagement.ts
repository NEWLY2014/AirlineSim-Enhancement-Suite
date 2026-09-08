"use strict";
(() => {
//MAIN
//Global vars
var settings: Record<string, unknown>;
var server: string;
var airline: AESModel.Airline;
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
    let input = $('<input type="text" id="aes-input-personnelManagement-value" class="form-control number aes-personnel-management-value" inputmode="numeric">').val(ensurePersonnelManagementSettings(settings).value);

    let option = [];
    option.push('<option value="absolute">AS$</option>');
    option.push('<option value="perc">%</option>');
    let select = $('<select id="aes-select-personnelManagement-type" class="form-control aes-personnel-management-type"></select>').append(...option);
    select.val(ensurePersonnelManagementSettings(settings).type);

    let btn = $('<button type="button" class="btn btn-default aes-personnel-management-apply">Apply salaries</button>');
    let lastUpdate = $('<span id="aes-personnel-management-last-update" class="aes-personnel-management-last-update"></span>').text('No previous update');

    let controls = $('<div class="form-inline aes-personnel-management-controls"></div>').append(
        $('<div class="form-group aes-personnel-management-control"></div>').append(
            $('<label class="control-label" for="aes-input-personnelManagement-value"></label>').text('Value'),
            input
        ),
        $('<div class="form-group aes-personnel-management-control"></div>').append(
            $('<label class="control-label" for="aes-select-personnelManagement-type"></label>').text('Type'),
            select
        ),
        $('<div class="form-group aes-personnel-management-action"></div>').append(btn)
    );

    let panel = $('<div class="as-panel aes-personnel-management-panel"></div>').append(controls, lastUpdate);

    //Final
    let mainDiv = getPersonnelManagementHeading();
    let root = $('<div id="aes-personnel-management-root"></div>').append('<h3>AES Personnel Management</h3>', panel);
    AES.markOwnedElements(root);
    if (!mainDiv.length) {
        throw new Error("Personnel management insertion target h1 was not found");
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
            setPersonnelLastUpdateText(lastUpdate, result[key]);
        } else {
            lastUpdate.text('No previous update');
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
            failSalaryUpdate('Salary table not found. AES could not locate the Employee Overview salary table.', options);
            return;
        }

        const rows = staffTableInfo.table.find('tbody tr').toArray();

        for (const row of rows) {
            const $row = $(row);

            const salaryForm = $row.find('form input[name="action"][value="salary"]').closest('form');
            const salaryInput = salaryForm.find('input[name="amount"]').first();
            if (!salaryInput.length) continue;

            const salary = AES.cleanInteger(salaryInput.val());

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
            failSalaryUpdate('Salary buttons not found. AES could not submit the calculated salary changes.', options);
            return;
        }

        const salaryForms = salaryButtons
            .map(function(salaryBtn) {
                return salaryBtn.closest('form')[0];
            })
            .filter(function(form, index, forms) {
                return form && forms.indexOf(form) === index;
        });

        finishSalaryUpdate(updatedRows
            ? null
            : 'All salaries are already at the target level.', options, function() {
            submitSalaryChanges(salaryButtons, salaryForms);
        });
    });
}

function submitSalaryChanges(salaryButtons: JQuery[], salaryForms: HTMLElement[]) {
    if (!salaryButtons.length) {
        return;
    }

    const buttonsToClick = salaryForms.length === 1
        ? [salaryButtons[0]]
        : salaryButtons;

    buttonsToClick.forEach(function(salaryBtn, index) {
        setTimeout(function() {
            salaryBtn.trigger('click');
        }, 75 + index * 75);
    });
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
    if (!AES.isRecord(data) || typeof data.date !== "string" || !data.date) {
        return 'No previous update';
    }

    return 'Last update: ' + AES.formatDateString(data.date) + (data.time ? ' ' + data.time : '');
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

function finishSalaryUpdate(message: string | null, options: AESModel.SalaryUpdateOptions = {}, callback?: () => void) {
    options = options || {};
    AES.updateSettings(function(currentSettings) {
        ensurePersonnelManagementSettings(currentSettings).auto = 0;
    }, function(finalSettings) {
        settings = finalSettings;
        const today = AES.getServerDate();
        const key = server + airline.id + 'personnelManagement';
        const data = {
            server: server,
            airline: airline,
            type: 'personnelManagement',
            date: today.date,
            time: today.time
        };
        chrome.storage.local.set({ [key]: data }, function() {
            updatePersonnelLastUpdate(data);
            setPersonnelManagementBusy(options.actionButton, false);
            if (message) {
                showPersonnelNotification(message, 'success');
            }
            if (typeof callback === 'function') {
                callback();
            }
        });
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
