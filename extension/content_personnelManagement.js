"use strict";
//MAIN
//Global vars
var settings, server, airline;
const PERSONNEL_MANAGEMENT_SCRIPT_ENABLED = AES.shouldRunContentScript("content_personnelManagement");
if (PERSONNEL_MANAGEMENT_SCRIPT_ENABLED) {
    $(function() {
        chrome.storage.local.get(['settings'], function(result) {
            settings = result.settings;
            //Default settings
            if (!settings.personnelManagement) {
                settings.personnelManagement = {
                    value: 0,
                    type: 'absolute',
                    auto: 0
                };
            }
            server = AES.getServerName();
            airline = AES.getAirline();

            displayPersonnelManagement();
        });
    });

    AES.whenPageOwnershipLost(function() {
        $('#aes-personnel-management-root').remove();
    });
}

function displayPersonnelManagement() {
    //Header rows
    let th = $('<tr></tr>').append('<th>Value</th>', '<th>Type</th>');
    let thead = $('<thead></thead>').append(th);
    //body rows
    let td = [];
    //Value
    let input = $('<input type="text" id="aes-input-personnelManagement-value" class="form-control number" style="min-width: 50px;">').val(settings.personnelManagement.value);

    //Select type
    let option = [];
    option.push('<option value="absolute">AS$</option>');
    option.push('<option value="perc">%</option>');
    let select = $('<select id="aes-select-personnelManagement-type" class="form-control"></select>').append(option);
    select.val(settings.personnelManagement.type);

    td.push($('<td></td>').html(input));
    td.push($('<td></td>').html(select));

    let bRow = $('<tr></tr>').append(td);
    let tbody = $('<tbody></tbody>').append(bRow);

    let table = $('<table class="table table-bordered"></table>').append(thead, tbody);
    let tableWell = $('<div class="as-table-well"></div>').append(table);
    //Text
    let p = $('<p></p>').text('Select value (either absolute AS$ value or % value) to keep your personnels salary in regards to country average. You can enter negative or positive values.');

    //buttons
    let btn = $('<button type="button" class="btn btn-default">apply salary</button>');
    //Span
    let span = $('<span></span>');


    let leftDiv = $('<div class="col-md-3"></div>').append(tableWell);
    let row = $('<div class="row"></div>').append(leftDiv);

    let panel = $('<div class="as-panel"></div>').append(p, row, btn, span);

    //Final
    let mainDiv = $(".container-fluid:eq(2) h1");
    let root = $('<div id="aes-personnel-management-root"></div>').append('<h3>AirlineSim Enhancement Suite Personnel Management</h3>', panel);
    AES.markOwnedElements(root);
    mainDiv.after(root);

    //actions
    select.change(function() {
        settings.personnelManagement.type = select.val();
        AES.updateSettings(function(currentSettings) {
            currentSettings.personnelManagement.type = settings.personnelManagement.type;
        }, function(updatedSettings) {
            settings = updatedSettings;
        });
    });
    input.on('input change', function() {
        settings.personnelManagement.value = AES.cleanInteger(input.val());
    });
    input.blur(function() {
        input.val(settings.personnelManagement.value);
        AES.updateSettings(function(currentSettings) {
            currentSettings.personnelManagement.value = settings.personnelManagement.value;
        }, function(updatedSettings) {
            settings = updatedSettings;
        });
    });

    btn.click(function() {
        settings.personnelManagement.type = select.val();
        settings.personnelManagement.value = AES.cleanInteger(input.val());
        input.val(settings.personnelManagement.value);
        span.removeClass().addClass('warning').text(' adjusting...');
        AES.updateSettings(function(currentSettings) {
            currentSettings.personnelManagement.type = settings.personnelManagement.type;
            currentSettings.personnelManagement.value = settings.personnelManagement.value;
            currentSettings.personnelManagement.auto = 1;
            currentSettings.personnelManagement.alreadyUpdated = [];
        }, function(updatedSettings) {
            settings = updatedSettings;
            salaryUpdate(span);
        });
    });

    //Automation
    if (settings.personnelManagement.auto) {
        span.removeClass().addClass('warning').text(' adjusting...');
        salaryUpdate(span);
    }

    //Previous data
    let key = server + airline.id + "personnelManagement";
    chrome.storage.local.get([key], function(result) {
        if (result[key]) {
            p.after($('<p></p>').text('Last time updated on ' + AES.formatDateString(result[key].date) + ' ' + result[key].time));
        } else {
            p.after($('<p></p>').text('No previous personnel management data found.'));
        }
    });
}

function salaryUpdate(span) {
    AES.updateSettings(function(currentSettings) {
        currentSettings.personnelManagement.auto = 1;
        currentSettings.personnelManagement.alreadyUpdated = [];
    }, function(updatedSettings) {
        settings = updatedSettings;
        let value = settings.personnelManagement.value;
        let type = settings.personnelManagement.type;
        let updatedRows = 0;
        let salaryButtons = [];
        const staffTableInfo = getStaffSalaryTableInfo();

        if (!staffTableInfo) {
            finishSalaryUpdate(span, ' salary table not found.');
            return;
        }

        const rows = staffTableInfo.table.find('tbody tr').toArray();

        for (const row of rows) {
            const $row = $(row);
            if ($row.find('th').length) continue; // Skip header

            const salaryForm = $row.find('form input[name="action"][value="salary"]').closest('form');
            const salaryInput = salaryForm.find('input[name="amount"]').first();
            if (!salaryInput.length) continue;

            const salary = AES.cleanInteger(salaryInput.val());

            let averageText = $row.children('td').eq(staffTableInfo.countryAverageIndex).text().replace(/\(.*?\)/g, '').trim();
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

        const salaryForms = salaryButtons
            .map(function(salaryBtn) {
                return salaryBtn.closest('form')[0];
            })
            .filter(function(form, index, forms) {
                return form && forms.indexOf(form) === index;
            });

        if (updatedRows > 0) {
            span.removeClass().addClass('warning').text(' submitting ' + updatedRows + ' salary changes...');
        }

        finishSalaryUpdate(span, ' all salaries at set level!', function() {
            if (salaryForms.length === 1) {
                salaryButtons[0].trigger('click');
            } else {
                salaryButtons.forEach(function(salaryBtn) {
                    salaryBtn.trigger('click');
                });
            }
        });
    });
}

function getStaffSalaryTableInfo() {
    const tables = $('.container-fluid:eq(2) table').toArray();

    for (const table of tables) {
        const tableInfo = getTableHeaderIndexes($(table));
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

function getTableHeaderIndexes(table) {
    const indexes = {};
    let columnIndex = 0;
    const firstHeaderRow = table.find('thead tr').first();

    firstHeaderRow.children('th').each(function() {
        const header = $(this);
        const title = header.text().trim().replace(/\s+/g, ' ').toLowerCase();
        const colspan = parseInt(header.attr('colspan') || '1', 10);

        if (title === "next week's salary") {
            indexes.salaryInputIndex = columnIndex;
        }
        if (title === 'country average') {
            indexes.countryAverageIndex = columnIndex;
        }

        columnIndex += colspan;
    });

    return indexes;
}

function finishSalaryUpdate(span, message, callback) {
    AES.updateSettings(function(currentSettings) {
        currentSettings.personnelManagement.auto = 0;
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
            span.removeClass().addClass('good').text(message);
            if (typeof callback === 'function') {
                callback();
            }
        });
    });
}
