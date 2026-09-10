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
    const yieldToPage = async () => {
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
        if (!AES.isPageOwner()) throw new Error('Page ownership lost.');
        if (scheduleChanged) throw new Error('Schedule changed during extraction. Please try again.');
    };
    try {
        await yieldToPage();
        const schedule = await AESRead.parseSchedule(document, message => span.text(message), () => {
            if (scheduleChanged) throw new Error('Schedule changed during extraction. Please try again.');
            return AES.isPageOwner();
        });
        span.text('Saving ' + schedule.length.toLocaleString() + ' routes...');
        await yieldToPage();
        await AESRead.save({type:'AES_SAVE_SCHEDULE',airline,
            snapshot:{date:date.date,updateTime:date.time,schedule}}, () => AES.isPageOwner());
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

})();
