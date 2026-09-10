"use strict";
(() => {
//MAIN
//Global vars
var server: string;
var airline: AESModel.Airline;
var ownerAirline: AESModel.Airline;
var activeTab: string;
var compData: AESModel.CompetitorRecord;
const ENTERPRISE_OVERVIEW_SCRIPT_ENABLED = AES.runContentScript("content_enterpriseOverview", function() {
    AES.waitForElement(function() {
        return $(".nav-tabs .active").length && AES.getEnterpriseHeading() && AES.getNavbarAirline().displayName;
    }, initializeEnterpriseOverview, {
        scriptName: "content_enterpriseOverview",
        errorMessage: "Enterprise overview insertion target enterprise heading was not found"
    });
});

function initializeEnterpriseOverview() {
    server = AES.getServerName();
    airline = AES.getAirline();
    ownerAirline = AES.getCurrentAirline();
    activeTab = ($(".nav-tabs .active").attr('class') || '').split(" ")[0];
    let key = AES.getCompetitorMonitoringKey(server, ownerAirline.id, airline.id);
    let legacyKey = AES.getCompetitorMonitoringKey(server, null, airline.id);
    chrome.storage.local.get([key, legacyKey], function(compMonitoringData) {
        AES.tryRun("content_enterpriseOverview", function() {
            if (!AES.isPageOwner()) return;
            if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
            compData = AES.getCompetitorPageData(compMonitoringData[key] || compMonitoringData[legacyKey], server, ownerAirline, airline);
            displayMain();
        });
    });
}

if (ENTERPRISE_OVERVIEW_SCRIPT_ENABLED) {
    AES.whenPageOwnershipLost(function() {
        $('#aes-panel-airline-competitive-monitoring').remove();
    });
}

function displayMain() {
    //Clean
    $('#aes-panel-airline-competitive-monitoring').remove();
    //panel
    let panel = $('<div class="as-panel"></div>');

    //Checkbox
    let checkbox = $<HTMLInputElement>('<input type="checkbox">');
    let label = $('<label></label>').append(checkbox, ' Follow this airline in Competitor Monitoring');
    let divCheckbox = $('<div class="checkbox"></div>').append(label);

    //Competitive display comp monitoring
    let divComp = $('<div></div>');
    checkbox.change(function() {
        const tracking = this.checked;
        const previousTracking = compData.tracking;
        compData.tracking = tracking ? 1 : 0;
        checkbox.prop('disabled', true);
        saveCompetitorRecord(function() {
            checkbox.prop('disabled', false);
            updateCompetitorMonitoringIndex(tracking);
            divComp.empty();
            if (!tracking) return;
            const actionBar = $('<ul class="as-panel as-action-bar"></ul>');
            divComp.append(actionBar);
            displayCompetitorMonitoring(divComp);
            switch (activeTab) {
                case 'tab0': displayTab0(actionBar); break;
                case 'tab2': displayTab2(actionBar); break;
                case 'tab1':
                case 'tab3': break;
                default: throw new Error("Unsupported enterprise tab: " + activeTab);
            }
            displayAutomation(actionBar);
        }, function(error) {
            compData.tracking = previousTracking;
            checkbox.prop('disabled', false).prop('checked', !!previousTracking);
            AES.reportContentScriptError("content_enterpriseOverview", error);
        });
    });
    //Checkbox default
    if (compData.tracking) {
        checkbox.prop('checked', true);
        checkbox.trigger("change");
    }
    //panel
    panel.append(divCheckbox);


    //Add display
    let mainDiv = $('<div id="aes-panel-airline-competitive-monitoring"></div>').append('<h3>AirlineSim Enhancement Suite Airline</h3>', panel, divComp);
    AES.markOwnedElements(mainDiv);
    let insertionTarget = $(AES.getEnterpriseHeading() || []);
    if (!insertionTarget.length) {
        throw new Error("Enterprise overview insertion target enterprise heading was not found");
    }
    insertionTarget.after(mainDiv);
}

function updateCompetitorMonitoringIndex(tracking: boolean) {
    if (!ownerAirline.id || !airline.id) {
        return;
    }

    let indexKey = AES.getCompetitorMonitoringIndexKey(server, ownerAirline.id);
    chrome.storage.local.get({ [indexKey]: [] }, function(result) {
        if (chrome.runtime.lastError) {
            AES.reportContentScriptError("content_enterpriseOverview", new Error(chrome.runtime.lastError.message));
            return;
        }
        let index: string[] = Array.isArray(result[indexKey]) ? result[indexKey].map(String) : [];
        let competitorId = String(airline.id);
        index = index.filter(function(id, position) {
            return index.indexOf(id) == position;
        });

        if (tracking) {
            if (index.indexOf(competitorId) == -1) {
                index.push(competitorId);
            }
        } else {
            index = index.filter(function(id) {
                return id != competitorId;
            });
        }

        chrome.storage.local.set({ [indexKey]: index }, function() {
            if (chrome.runtime.lastError) AES.reportContentScriptError("content_enterpriseOverview", new Error(chrome.runtime.lastError.message));
        });
    });
}

function displayAutomation(actionBar: JQuery) {
    if (!compData.autoExtract) { //
        let span = $('<span></span>');
        let btn = $('<button type="button" class="btn btn-default">save all tab data</button>');
        btn.on('click', async function() {
            if (btn.prop('disabled')) return;
            const current = AESRead.context();
            const controls = $('#aes-panel-airline-competitive-monitoring').find('button,input').toArray();
            const disabled = controls.map(element => $(element).prop('disabled'));
            controls.forEach(element => $(element).prop('disabled',true));
            btn.prop('disabled',true);span.removeClass().addClass('warning').text('Fetching...');
            try {
                await AESRead.collectCompetitor(airline,message => {if(current())span.text(message);},current);
                const stored = (await chrome.storage.local.get(compData.key))[compData.key];
                if (current() && AES.isRecord(stored)) Object.assign(compData,stored);
                if (current()) {span.removeClass().addClass('good').text('All tab data saved.');btn.prop('disabled',false);}
            } catch (error) {
                if(current()){btn.prop('disabled',false);span.removeClass().addClass('bad').text(error instanceof Error ? error.message : String(error));}
            } finally {if(current())controls.forEach((element,i)=>$(element).prop('disabled',disabled[i]));}
        });
        let li = $('<li></li>').append(btn, span);
        actionBar.append(li);
    } else {
        let span = $('<span></span>').addClass('warning').text('Please wait... extracting all tab info...');
        let li = $('<li></li>').append(span);
        actionBar.append(li);
    }
}

function displayCompetitorMonitoring(div: JQuery) {
    let th = [];
    th.push('<th>Overview</th>');
    th.push('<th>Facts and Figures</th>');
    th.push('<th>Schedule</th>');
    let headRow = $('<tr></tr>').append(...th);
    let thead = $('<thead></thead>').append(headRow);
    //body
    let td = [];
    td.push($('<td></td>').append(displayOverviewRow()));
    td.push($('<td></td>').append(displayFactsAndFiguresRow()));
    td.push($('<td></td>').append(displayScheduleRow()));
    let row = $('<tr></tr>').append(td);
    let tbody = $('<tbody></tbody>').append(row);
    let table = $('<table class="table table-bordered table-striped table-hover"></table>').append(thead, tbody);
    let divTable = $('<div class="as-table-well"></div>').append(table);
    let divPanel = $('<div class="as-panel"></div>').append(divTable);

    div.append(divPanel);

}

function displayTab0(actionBar: JQuery) {
    //Get data
    let data = getTab0Data();
    //Save Data
    let span = $('<span></span>');
    let btnSave = $('<button id="aes-btn-save-tab0-data" type="button" class="btn btn-default">save competitor overview data</button>');

    btnSave.click(function() {
        btnSave.prop('disabled', true);
        span.removeClass().addClass('warning').text('saving data...');
        let time = AES.getServerDate()

        const previous = compData.tab0[time.date];
        data.updateTime = time.time;
        data.date = time.date;
        compData.tab0[time.date] = data;
        saveCompetitorRecord(function() {
            btnSave.remove();
            span.removeClass().addClass("good").text("Overview Tab data Saved!");
            if (compData.autoExtract) void AES.queuePage('./' + airline.id + '?tab=2', 'navigate').catch(error => AES.reportContentScriptError('page_queue', error));
        }, function(error) {
            if (previous === undefined) delete compData.tab0[time.date];
            else compData.tab0[time.date] = previous;
            btnSave.prop('disabled', false);
            span.removeClass().addClass('bad').text(error.message);
        });
    });
    let li = $('<li></li>').append(span, btnSave);
    actionBar.append(li);

    //Automation
    if (compData.autoExtract) {
        btnSave.click();
    }
}

function displayTab2(actionBar: JQuery) {
    let data = getTab2Data();
    //Save Data
    let span = $('<span></span>');
    let btnSave = $('<button type="button" class="btn btn-default">save fact and figures data</button>');

    //Check if this week already saved
    let update = 1;
    const dates = getCompetitorHistoryDates(compData.tab2);
    if (dates.length) {
        const previous = compData.tab2[dates[0]];
        if (AES.isRecord(previous) && previous.week == data.week) {
            update = 0;
        }
    }


    let li;
    if (update) {
        btnSave.click(function() {
            btnSave.prop('disabled', true);
            span.removeClass().addClass('warning').text('saving data...');
            let time = AES.getServerDate()

            const previous = compData.tab2[time.date];
            data.updateTime = time.time;
            data.date = time.date;
            compData.tab2[time.date] = data;
            saveCompetitorRecord(function() {
                btnSave.remove();
                span.removeClass().addClass("good").text("Fact and figures Tab data Saved!");
                if (compData.autoExtract) void AES.queuePage('./' + airline.id + '?tab=3', 'navigate').catch(error => AES.reportContentScriptError('page_queue', error));
            }, function(error) {
                if (previous === undefined) delete compData.tab2[time.date];
                else compData.tab2[time.date] = previous;
                btnSave.prop('disabled', false);
                span.removeClass().addClass('bad').text(error.message);
            });
        });
        li = $('<li></li>').append(span, btnSave);
    } else {
        span.addClass('good').text('The current week facts and figures data is already saved');
        li = $('<li></li>').append(span);
    }


    actionBar.append(li);

    //Automation
    if (compData.autoExtract) {
        if (update) {
            btnSave.click();
        } else {
            void AES.queuePage('./' + airline.id + '?tab=3', 'navigate').catch(error => AES.reportContentScriptError('page_queue', error));
        }
    }
}

function displayOverviewRow() {
    let span = $('<span></span>');
    const dates = getCompetitorHistoryDates(compData.tab0);
    if (dates.length) {
        let diff = AES.getDateDiff([AES.getServerDate().date, dates[0]]);
        span.text('Last overview extract ' + AES.formatDateString(dates[0]) + ' (' + diff + ' days ago)');
        if (diff >= 0 && diff < 7) {
            span.addClass('good');
        } else {
            span.addClass('warning');
        }
    } else {
        span.addClass('bad').text('No Overview data')
    }
    return span;
}

function displayFactsAndFiguresRow() {
    let span = $('<span></span>');
    const dates = getCompetitorHistoryDates(compData.tab2);
    if (dates.length) {
        let diff = AES.getDateDiff([AES.getServerDate().date, dates[0]]);
        const latest = compData.tab2[dates[0]];
        span.text('Last facts and figures extract for week ' + formatWeekDate(AES.isRecord(latest) ? latest.week : undefined) + ' done on ' + AES.formatDateString(dates[0]) + ' (' + diff + ' days ago)');
        if (diff >= 0 && diff < 7) {
            span.addClass('good');
        } else {
            span.addClass('warning');
        }
    } else {
        span.addClass('bad').text('No facts and figures data');
    }
    return span;
}

function displayScheduleRow() {
    let span = $('<span></span>');
    const dates = getCompetitorHistoryDates(compData.tab0);
    if (dates.length) {
        const overview = compData.tab0[dates[0]];
        const id = AES.isRecord(overview) ? overview.id : undefined;
        if (typeof id !== "string" && typeof id !== "number") return span.addClass('bad').text('No Schedule data found.');
        let scheduleKey = server + id + 'schedule';
        chrome.storage.local.get([scheduleKey], function(result) {
            let scheduleData = result[scheduleKey];
            if (AES.isRecord(scheduleData) && AES.isRecord(scheduleData.date)) {
                const scheduleDates = getCompetitorHistoryDates(scheduleData.date);
                if (!scheduleDates.length) {
                    span.addClass('bad').text('No Schedule data found.');
                    return;
                }
                let diff = AES.getDateDiff([AES.getServerDate().date, scheduleDates[0]]);
                span.text('Last schedule extract ' + AES.formatDateString(scheduleDates[0]) + ' (' + diff + ' days ago)');
                if (diff >= 0 && diff < 7) {
                    span.addClass('good');
                } else {
                    span.addClass('warning');
                }
            } else {
                //no schedule
                span.addClass('bad').text('No Schedule data found.');
            }
        });
    } else {
        span.addClass('bad').text('Extract overview to see schedule data');
    }
    return span;

}

function getTab0Data() {return AESRead.overview(document,AES.getAirline());}
function getTab2Data() {return AESRead.facts(document);}

function formatWeekDate(date: unknown) {
    if (typeof date !== 'string' && typeof date !== 'number') return 'unknown';
    let a = String(date);
    return a.substring(0, 2) + '/' + a.substring(2, 6);
}

function getCompetitorHistoryDates(history: Record<string, unknown>): string[] {
    return Object.keys(history).filter(date => /^\d{8}$/.test(date) && AES.isRecord(history[date]))
        .sort((a, b) => Number(b) - Number(a));
}

function saveCompetitorRecord(onSuccess: () => void, onFailure: (error: Error) => void) {
    chrome.storage.local.set({ [compData.key]: compData }, function() {
        if (chrome.runtime.lastError) {
            onFailure(new Error('Unable to save competitor data: ' + chrome.runtime.lastError.message));
            return;
        }
        if (AES.isPageOwner()) AES.tryRun("content_enterpriseOverview", onSuccess);
    });
}

})();
