"use strict";
(() => {
//MAIN
var settings: Record<string, unknown>;
var compData: AESModel.CompetitorRecord | undefined;
var server: string;
var airline: AESModel.Airline;
var ownerAirline: AESModel.Airline;
var date: { date: string; time: string };
const FLIGHT_SCHEDULE_SCRIPT_ENABLED = AES.runContentScript("content_flightSchedule", function() {
    server = AES.getServerName();
    airline = AES.getAirline();
    ownerAirline = AES.getCurrentAirline();
    date = AES.getServerDate();
    chrome.storage.local.get(['settings'], function(result) {
        if (!AES.isPageOwner()) return;
        if (chrome.runtime.lastError) {
            AES.reportContentScriptError("content_flightSchedule", new Error(chrome.runtime.lastError.message));
            return;
        }
        AES.waitForElement(function() {
            return $('.flight-schedule');
        }, function() {
            initializeFlightSchedule(result);
        }, {
            scriptName: "content_flightSchedule",
            errorMessage: "Flight schedule insertion target .flight-schedule was not found"
        });
    });
});

if (FLIGHT_SCHEDULE_SCRIPT_ENABLED) {
    AES.whenPageOwnershipLost(function() {
        $('#aes-schedule-heading, #aes-panel-schedule').remove();
    });
}
//FUNCTIONS
function initializeFlightSchedule(result: Record<string, unknown>) {
    settings = AES.isRecord(result.settings) ? result.settings : {};
    let label = $('<h3 id="aes-schedule-heading"></h3>').text('AES Schedule');
    let btn = $('<button class="btn btn-default" id="aes-extractSchedule-btn"></button>').text('Extract Schedule');
    let panel = $('<div id="aes-panel-schedule" class="as-panel"></div>').append(btn);
    AES.markOwnedElements([label[0], panel[0]]);
    //Main DIv
    if (!$('.flight-schedule').length) {
        throw new Error("Flight schedule insertion target .flight-schedule was not found");
    }
    $('.flight-schedule').prepend(label, panel);

    //Extract Schedule
    btn.click(function() {
        extractSchedule();
    });

    //Automation
    if (AES.isRecord(settings.schedule) && settings.schedule.autoExtract) {
        AES.updateSettings(function(currentSettings) {
            const scheduleSettings = AES.isRecord(currentSettings.schedule) ? currentSettings.schedule : {};
            scheduleSettings.autoExtract = 0;
            currentSettings.schedule = scheduleSettings;
        }, function(updatedSettings) {
            settings = updatedSettings;
            btn.click();
        });
    } else {
        //Check if automation via competitor monitoring
        let key = AES.getCompetitorMonitoringKey(server, ownerAirline.id, airline.id);
        let legacyKey = AES.getCompetitorMonitoringKey(server, null, airline.id);
        chrome.storage.local.get([key, legacyKey], function(compMonitoringData) {
            if (!AES.isPageOwner()) return;
            if (chrome.runtime.lastError) {
                AES.reportContentScriptError("content_flightSchedule", new Error(chrome.runtime.lastError.message));
                return;
            }
            compData = AES.getCompetitorPageData(compMonitoringData[key] || compMonitoringData[legacyKey], server, ownerAirline, airline);
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
}

function extractSchedule() {
    // Update UI
    $('#aes-schedule-status').remove();
    let span = $('<span id="aes-schedule-status" class="warning"></span>').text('Extracting...');
    $('#aes-panel-schedule').append(span);
    const button = $('#aes-extractSchedule-btn').prop('disabled', true);
    const fail = (message: string) => {
        span.removeClass().addClass('bad').text(message);
        button.prop('disabled', false);
    };

    // Pull every table-body and build an array of route-segments
    let tbodyList = $('.flight-schedule table tbody');
    let schedule: AESModel.ScheduleRoute[] = [];

    for (let i = 0; i < tbodyList.length; i++) {
        let destinationCount = 0;
        let rows = $<HTMLTableRowElement>('tr', tbodyList[i]);
        let route: Partial<AESModel.ScheduleRoute> = {};

        for (let j = 0; j < rows.length; j++) {
            let cls = rows[j].className;

            if (cls === 'important origin') {
                // origin row
                route.origin = $('a', rows[j]).text();

            } else if (cls === 'destination') {
                // on a second+ destination, push the prior segment
                if (destinationCount) {
                    if (isCompleteScheduleRoute(route)) schedule.push(route);
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
        if (isCompleteScheduleRoute(route)) schedule.push(route);
    }

    if (!schedule.length) {
        fail('No flight segments found. Existing schedule data was kept.');
        return;
    }

    // build hub counts for OD logic
    let hub: Record<string, number> = {};
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
    let newScheduleData: AESModel.ScheduleSnapshot = { date: date.date, updateTime: date.time, schedule };
    let key = server + airline.id + 'schedule';
    let defaultScheduleData: AESModel.ScheduleRecord = { type: 'schedule', server, airline, date: {} };

    chrome.storage.local.get({ [key]: defaultScheduleData }, function(result) {
        if (!AES.isPageOwner()) return;
        if (chrome.runtime.lastError) {
            fail('Unable to read schedule history: ' + chrome.runtime.lastError.message);
            return;
        }
        const old = AES.isRecord(result[key]) ? result[key] : {};
        const scheduleData: AESModel.ScheduleRecord = {
            ...old, type: 'schedule', server, airline,
            date: { ...(AES.isRecord(old.date) ? old.date : {}), [date.date]: newScheduleData }
        };
        chrome.storage.local.set({ [key]: scheduleData }, function() {
            if (!AES.isPageOwner()) return;
            if (chrome.runtime.lastError) {
                fail('Unable to save schedule: ' + chrome.runtime.lastError.message);
                return;
            }
            const complete = () => {
                span.removeClass().addClass('good').text('Schedule extracted!');
                button.remove();
            };
            const competitor = compData;
            if (competitor?.autoExtract) {
                chrome.storage.local.set({ [competitor.key]: { ...competitor, autoExtract: 0 } }, function() {
                    if (!AES.isPageOwner()) return;
                    if (chrome.runtime.lastError) {
                        fail('Schedule saved, but automation could not be completed: ' + chrome.runtime.lastError.message);
                        return;
                    }
                    competitor.autoExtract = 0;
                    complete();
                    void AES.queuePage('./' + airline.id + '?tab=0', 'navigate').catch(error => AES.reportContentScriptError('page_queue', error));
                });
            } else complete();
        });
    });
}

function getLineDetails(row: HTMLTableRowElement, route: Partial<AESModel.ScheduleRoute>) {
    // parse flight number
    let parts = $(".code:eq(0)", row).text().trim().split(/\s+/);
    let flightNumber = parseInt(parts[1], 10);

    if (!/^\d+$/.test(parts[1] || '') || !Number.isSafeInteger(flightNumber)) return route;

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

function isCompleteScheduleRoute(route: Partial<AESModel.ScheduleRoute>): route is AESModel.ScheduleRoute {
    return !!route.origin && !!route.destination && !!route.flightNumber && Object.keys(route.flightNumber).length > 0;
}

})();
