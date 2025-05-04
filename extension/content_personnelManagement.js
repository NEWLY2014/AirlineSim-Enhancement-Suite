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
        chrome.storage.local.set({ settings: settings }, function() {});
    });
    input.change(function() {
        settings.personnelManagement.value = AES.cleanInteger(input.val());
        chrome.storage.local.set({ settings: settings }, function() {});
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

function salaryUpdate(span) {
    chrome.storage.local.set({ settings: settings }, function() {
        let value = settings.personnelManagement.value;
        let type = settings.personnelManagement.type;
        let updatedRows = 0;

        $('.container-fluid:eq(2) table:eq(1) tbody').each(function() {
            $(this).find('tr').each(function() {
                if (!$(this).find('th').length) {  // skip header rows
                    let salaryInput = $(this).find('form input:eq(2)');
                    let salary = AES.cleanInteger(salaryInput.val());

                    let averageText = $(this).find('td:eq(9)').text();
                    averageText = averageText.replace(/\(.*?\)/g, '').trim();  // clean brackets
                    let average = AES.cleanInteger(averageText);

                    let salaryBtn = $(this).find('td:eq(8) form .input-group-btn input');
                    let newSalary;

                    if (type === 'absolute') {
                        newSalary = average + value;
                    } else if (type === 'perc') {
                        newSalary = Math.round(average * (1 + value * 0.01));
                    } else {
                        newSalary = salary;
                    }

                    if (newSalary !== salary) {
                        salaryInput.val(newSalary);
                        salaryBtn.trigger('click');  // use trigger() to simulate click reliably
                        updatedRows++;
                    }
                }
            });
        });

        settings.personnelManagement.auto = 0;
        chrome.storage.local.set({ settings: settings }, function() {
            let today = AES.getServerDate();
            let key = server + airline.id + 'personnelManagement';
            let data = {
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

