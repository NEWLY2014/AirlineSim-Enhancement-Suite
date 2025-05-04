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
        server = getServerName();
        airline = getAirline();

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
        priceUpdate(span);
    });

    //Automation
    if (settings.personnelManagement.auto) {
        span.removeClass().addClass('warning').text(' adjusting...');
        priceUpdate(span);
    }

    //Previous data
    let key = server + airline + "personnelManagement";
    chrome.storage.local.get([key], function(result) {
        if (result[key]) {
            p.after($('<p></p>').text('Last time updated on ' + AES.formatDateString(result[key].date) + ' ' + result[key].time));
        } else {
            p.after($('<p></p>').text('No previous personnel management data found.'));
        }
    });
}

function priceUpdate(span) {
    chrome.storage.local.set({ settings: settings }, function() {
        let value = settings.personnelManagement.value;
        let type = settings.personnelManagement.type;
        let found = 0;
        let rowIndex = 0; // external counter

        $('.container-fluid:eq(2) table:eq(1) tbody tr').each(function() {
            if (!$(this).find('th').length) {
                if (settings.personnelManagement.alreadyUpdated.includes(rowIndex)) {
                    rowIndex++;
                    return true; // skip to next row
                }

                let salaryInput = $(this).find('form input:eq(2)');
                let salary = AES.cleanInteger(salaryInput.val());
                let average = AES.cleanInteger($(this).find('td:eq(9)').text());
                let salaryBtn = $(this).find('td:eq(8) > form .input-group-btn input');
                let newSalary;

                switch (type) {
                    case 'absolute':
                        newSalary = average + value;
                        break;
                    case 'perc':
                        newSalary = Math.round((average * (1 + value * 0.01)));
                        break;
                    default:
                        newSalary = salary;
                }

                if (newSalary != salary) {
                    settings.personnelManagement.alreadyUpdated.push(rowIndex);
                    chrome.storage.local.set({ settings: settings }, function() {});
                    salaryInput.val(newSalary);
                    salaryBtn.click();
                    found = 1;
                    // continue to update all rows
                }
            }
            rowIndex++; // increase external index
        });

        if (!found) {
            settings.personnelManagement.auto = 0;
            settings.personnelManagement.alreadyUpdated = [];
            chrome.storage.local.set({ settings: settings }, function() {

                // Save into memory
                let today = AES.getServerDate();
                let key = server + airline + 'personnelManagement';
                let personnelManagementData = {
                    server: server,
                    airline: airline,
                    type: 'personnelManagement',
                    date: today.date,
                    time: today.time
                };
                chrome.storage.local.set({
                    [key]: personnelManagementData
                }, function() {
                    span.removeClass().addClass('good').text(' all salaries at set level!');
                });
            });
        }
    });
}


function getAirline() {
    let airline = $("#as-navbar-main-collapse ul li:eq(0) a:eq(0)").text().trim().replace(/[^A-Za-z0-9]/g, '');
    return airline;
}

function getServerName() {
    let server = window.location.hostname
    server = server.split('.');
    return server[0];
}
