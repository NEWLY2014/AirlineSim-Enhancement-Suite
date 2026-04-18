"use strict";
//MAIN
//Global vars
var settings, server, airline;
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
    mainDiv.after('<h3>AirlineSim Enhancement Suite Personnel Management</h3>', panel);

    //actions
    select.change(function() {
        settings.personnelManagement.type = select.val();
        AES.updateSettings(function(currentSettings) {
            currentSettings.personnelManagement.type = settings.personnelManagement.type;
        }, function(updatedSettings) {
            settings = updatedSettings;
        });
    });
    input.change(function() {
        settings.personnelManagement.value = AES.cleanInteger(input.val());
        AES.updateSettings(function(currentSettings) {
            currentSettings.personnelManagement.value = settings.personnelManagement.value;
        }, function(updatedSettings) {
            settings = updatedSettings;
        });
    });

    btn.click(function() {
        span.removeClass().addClass('warning').text(' adjusting...');
        //Set button for auto click
        settings.personnelManagement.auto = 1;
        settings.personnelManagement.alreadyUpdated = [];
        salaryUpdate(span);
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

async function salaryUpdate(span) {
    AES.updateSettings(function(currentSettings) {
        currentSettings.personnelManagement.auto = 1;
        currentSettings.personnelManagement.alreadyUpdated = [];
    }, async function(updatedSettings) {
        settings = updatedSettings;
        let value = settings.personnelManagement.value;
        let type = settings.personnelManagement.type;
        let updatedRows = 0;

        const rows = $('.container-fluid:eq(2) table:eq(1) tbody tr').toArray();

        for (const row of rows) {
            const $row = $(row);
            if ($row.find('th').length) continue; // Skip header

            const salaryInput = $row.find('form input:eq(2)');
            const salary = AES.cleanInteger(salaryInput.val());

            let averageText = $row.find('td:eq(9)').text().replace(/\(.*?\)/g, '').trim();
            const average = AES.cleanInteger(averageText);
            const salaryBtn = $row.find('td:eq(8) form .input-group-btn input');

            let newSalary = salary;
            if (type === 'absolute') {
                newSalary = average + value;
            } else if (type === 'perc') {
                newSalary = Math.round(average * (1 + value * 0.01));
            }

            if (newSalary !== salary) {
                salaryInput.val(newSalary).trigger('input');
                salaryBtn.closest('form')[0].submit();
                updatedRows++;

                // Delay to allow form submission to complete
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

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
                span.removeClass().addClass('good').text(' all salaries at set level!');
            });
        });
    });
}

