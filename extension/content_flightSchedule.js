"use strict";
//MAIN
var settings, compData, server, airline, ownerAirline, date;
$(function() {
    server = AES.getServerName();
    airline = AES.getAirline();
    ownerAirline = AES.getCurrentAirline();
    date = AES.getServerDate();
    chrome.storage.local.get(['settings'], function(result) {
        settings = result.settings;
        let label = $('<h3></h3>').text('AES Schedule');
        let btn = $('<button class="btn btn-default" id="aes-extractSchedule-btn"></button>').text('Extract Schedule');
        let panel = $('<div id="aes-panel-schedule" class="as-panel"></div>').append(btn);
        //Main DIv
        $('.flight-schedule').prepend(label, panel);

        //Extract Schedule
        btn.click(function() {
            extractSchedule();
        });

        //Automation
        if (settings.schedule.autoExtract) {
            AES.updateSettings(function(currentSettings) {
                currentSettings.schedule.autoExtract = 0;
            }, function(updatedSettings) {
                settings = updatedSettings;
                btn.click();
            });
        } else {
            //Check if automation via competitor monitoring
            let key = AES.getCompetitorMonitoringKey(server, ownerAirline.id, airline.id);
            let legacyKey = AES.getCompetitorMonitoringKey(server, null, airline.id);
            chrome.storage.local.get([key, legacyKey], function(compMonitoringData) {
                compData = compMonitoringData[key] || compMonitoringData[legacyKey];
                if (compData) {
                    if (compData.autoExtract) {
                        compData.key = key;
                        compData.ownerId = ownerAirline.id;
                        compData.ownerAirline = ownerAirline;
                        btn.click();
                    }
                }
            });

        }
    });
});
//FUNCTIONS
function extractSchedule() {
    // Update UI
    let span = $('<span class="warning"></span>').text('Extracting...');
    $('#aes-panel-schedule').append(span);
    $('#aes-extractSchedule-btn').remove();

    // Pull every table-body and build an array of route-segments
    let tbodyList = $('.flight-schedule table tbody');
    let schedule = [];

    for (let i = 0; i < tbodyList.length; i++) {
        let destinationCount = 0;
        let rows = $('tr', tbodyList[i]);
        let route = {};

        for (let j = 0; j < rows.length; j++) {
            let cls = rows[j].className;

            if (cls === 'important origin') {
                // origin row
                route.origin = $('a', rows[j]).text();

            } else if (cls === 'destination') {
                // on a second+ destination, push the prior segment
                if (destinationCount) {
                    schedule.push(route);
                    route = { origin: route.origin };
                }
                route.destination = $('a', rows[j]).text();
                destinationCount++;

            } else if (cls !== 'head') {
                // line-detail row; skip A→C “via B” rows
                let remarkText = $(".remarks", rows[j]).text();
                if (remarkText.includes('via')) continue;

                route = getLineDetails(rows[j], route);
            }
        }

        // push the last segment for this table
        schedule.push(route);
    }

    // build hub counts for OD logic
    let hub = {};
    schedule.forEach(r => { hub[r.origin] = (hub[r.origin]||0) + 1 });

    // assign od & direction
    schedule.forEach(route => {
        if      (hub[route.origin] > hub[route.destination]) { route.od = route.origin + route.destination; route.direction = 'Outbound'; }
        else if (hub[route.origin] < hub[route.destination]) { route.od = route.destination + route.origin; route.direction = 'Inbound';  }
        else {
            if (route.origin < route.destination) {
                route.od = route.origin + route.destination; route.direction = 'Outbound';
            } else {
                route.od = route.destination + route.origin; route.direction = 'Inbound';
            }
        }
    });

    // save into chrome.storage
    let newScheduleData = { date: date.date, updateTime: date.time, schedule };
    let key = server + airline.id + 'schedule';
    let defaultScheduleData = { type: 'schedule', server, airline, date: {} };

    chrome.storage.local.get({ [key]: defaultScheduleData }, function(result) {
        let scheduleData = result[key];
        scheduleData.airline = airline;
        scheduleData.date[date.date] = newScheduleData;
        chrome.storage.local.set({ [key]: scheduleData }, function() {
            span.removeClass().addClass('good').text('Schedule extracted!');
            if (compData && compData.autoExtract) {
                compData.autoExtract = 0;
                chrome.storage.local.set({ [compData.key]: compData }, function() {
                    window.open('./' + airline.id + '?tab=0', '_self');
                });
            }
        });
    });
}

function getLineDetails(row, route) {
    // parse flight number
    let parts = $(".code:eq(0)", row).text().split(' ');
    let flightNumber = parseInt(parts[1], 10);

    // ensure container
    if (!route.flightNumber) route.flightNumber = {};

    // always re-initialize the entry
    let remark = $(".remarks", row).text();
    let valid  = $(".valid", row).text();

    route.flightNumber[flightNumber] = {
        paxFreq:   0,
        cargoFreq: 0,
        remark,
        valid
    };

    // count days: cargo vs pax based on remark
    let days   = $(".days", row).text().split('');
    let isCargo = remark.includes('CARGO FLIGHT');

    for (let d of days) {
        if (d >= '0' && d <= '9') {
            if (isCargo) route.flightNumber[flightNumber].cargoFreq++;
            else         route.flightNumber[flightNumber].paxFreq++;
        }
    }

    return route;
}
