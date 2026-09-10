"use strict";
(() => {
//MAIN
var settings: Record<string, unknown>;
var compData: AESModel.CompetitorRecord | undefined;
var server: string;
var airline: AESModel.Airline;
var ownerAirline: AESModel.Airline;
var date: { date: string; time: string };
let extracting = false;
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

async function extractSchedule() {
    if (extracting || !AES.isPageOwner()) return;
    extracting = true;
    // Update UI
    $('#aes-schedule-status').remove();
    let span = $('<span id="aes-schedule-status" class="warning"></span>').text('Extracting...');
    $('#aes-panel-schedule').append(span);
    const button = $('#aes-extractSchedule-btn').prop('disabled', true);
    const fail = (message: string) => {
        span.removeClass().addClass('bad').text(message);
        button.prop('disabled', false);
    };

    // Let the status paint first, then bound each parsing turn by time and row count.
    let scheduleChanged = false;
    const observer = new MutationObserver(changes => {
        if (changes.some(change => {
            const target = change.target instanceof Element ? change.target : change.target.parentElement;
            return !target?.closest('#aes-panel-schedule, #aes-schedule-heading');
        })) scheduleChanged = true;
    });
    for (const container of document.querySelectorAll('.flight-schedule')) {
        observer.observe(container, {subtree:true, childList:true, characterData:true, attributes:true});
    }
    let processed = 0;
    let turnStarted = performance.now();
    let turnRows = 0;
    const yieldToPage = async () => {
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
        if (!AES.isPageOwner()) throw new Error('Page ownership lost.');
        if (scheduleChanged) throw new Error('Schedule changed during extraction. Please try again.');
        turnStarted = performance.now();
        turnRows = 0;
    };
    const needsYield = () => ++turnRows >= 100 || performance.now() - turnStarted >= 8;
    try {
        await yieldToPage();
        const schedule: AESModel.ScheduleRoute[] = [];
        for (const tbody of document.querySelectorAll('.flight-schedule table tbody')) {
            let destinationCount = 0;
            let route: Partial<AESModel.ScheduleRoute> = {};
            // Walking siblings avoids materializing a second array of every flight row.
            for (let child = tbody.firstElementChild; child; child = child.nextElementSibling) {
                if (!(child instanceof HTMLTableRowElement)) continue;
                const cls = child.className;
                if (cls === 'important origin') {
                    route.origin = scheduleCellText(child, 'a');
                } else if (cls === 'destination') {
                    if (destinationCount && isCompleteScheduleRoute(route)) schedule.push(route);
                    if (destinationCount) route = {origin: route.origin};
                    route.destination = scheduleCellText(child, 'a');
                    destinationCount++;
                } else if (cls !== 'head') {
                    const remark = scheduleCellText(child, '.remarks');
                    if (!remark.includes('via')) route = getLineDetails(child, route, remark);
                }
                processed++;
                if (needsYield()) {
                    span.text('Extracting... ' + processed.toLocaleString() + ' rows processed');
                    await yieldToPage();
                }
            }
            if (isCompleteScheduleRoute(route)) schedule.push(route);
        }
        if (!schedule.length) throw new Error('No flight segments found. Existing schedule data was kept.');

        span.text('Preparing ' + schedule.length.toLocaleString() + ' routes...');
        const hub: Record<string, number> = {};
        for (const route of schedule) {
            hub[route.origin] = (hub[route.origin] || 0) + 1;
            if (needsYield()) await yieldToPage();
        }
        for (const route of schedule) {
            if (hub[route.origin] > hub[route.destination]) { route.od = route.origin + route.destination; route.direction = 'Outbound'; }
            else if (hub[route.origin] < hub[route.destination]) { route.od = route.destination + route.origin; route.direction = 'Inbound'; }
            else if (route.origin < route.destination) { route.od = route.origin + route.destination; route.direction = 'Outbound'; }
            else { route.od = route.destination + route.origin; route.direction = 'Inbound'; }
            if (needsYield()) await yieldToPage();
        }

        span.text('Saving ' + schedule.length.toLocaleString() + ' routes...');
        await yieldToPage();
        // Only today's snapshot crosses the page boundary. Historical records stay in the worker.
        await new Promise<void>((resolve, reject) => {
            chrome.runtime.sendMessage({type:'AES_SAVE_SCHEDULE', airline,
                snapshot:{date:date.date, updateTime:date.time, schedule}}, (response: unknown) => {
                if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
                if (!AES.isRecord(response) || response.ok !== true) {
                    reject(new Error(AES.isRecord(response) ? String(response.error) : 'Schedule storage is unavailable.')); return;
                }
                resolve();
            });
        });
        if (!AES.isPageOwner()) return;
        const competitor = compData;
        const automatedCompetitorSave = !!competitor?.autoExtract;
        if (competitor?.autoExtract) {
            await new Promise<void>((resolve, reject) => chrome.storage.local.set({[competitor.key]: {...competitor, autoExtract:0}}, () => {
                if (chrome.runtime.lastError) reject(new Error('Schedule saved, but automation could not be completed: ' + chrome.runtime.lastError.message));
                else resolve();
            }));
            if (!AES.isPageOwner()) return;
            competitor.autoExtract = 0;
        }
        span.removeClass().addClass('good').text('Schedule extracted!');
        button.remove();
        if (competitor && automatedCompetitorSave) {
            void AES.queuePage('./' + airline.id + '?tab=0', 'navigate').catch(error => AES.reportContentScriptError('page_queue', error));
        }
    } catch (error) {
        if (AES.isPageOwner()) fail(error instanceof Error ? error.message : String(error));
    } finally {
        observer.disconnect();
        extracting = false;
    }
}

// Recheck ownership after the background has read history, before it commits a save.
chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
    if (!AES.isRecord(message) || message.type !== 'AES_SCHEDULE_OWNER_CHECK') return false;
    reply({ok: sender.id === chrome.runtime.id && extracting && AES.isPageOwner()});
    return false;
});

function scheduleCellText(row: HTMLTableRowElement, selector: string) {
    return row.querySelector(selector)?.textContent || '';
}

function getLineDetails(row: HTMLTableRowElement, route: Partial<AESModel.ScheduleRoute>, remark: string) {
    // parse flight number
    let parts = scheduleCellText(row, '.code').trim().split(/\s+/);
    let flightNumber = parseInt(parts[1], 10);

    if (!/^\d+$/.test(parts[1] || '') || !Number.isSafeInteger(flightNumber)) return route;

    // ensure container
    if (!route.flightNumber) route.flightNumber = {};

    // always re-initialize the entry
    let valid  = scheduleCellText(row, '.valid');

    route.flightNumber[flightNumber] = {
        paxFreq:   0,
        cargoFreq: 0,
        remark,
        valid
    };

    // count days: cargo vs pax based on remark
    let days   = scheduleCellText(row, '.days').split('');
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
