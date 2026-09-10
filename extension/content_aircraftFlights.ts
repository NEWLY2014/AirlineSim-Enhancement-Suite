"use strict";
(() => {
//MAIN
//Global vars
let aircraftFlightData: AESModel.AircraftFlightData;
let aircraftFlightAirline: AESModel.Airline;
let aircraftFleetKey: string;
let aircraftFlightNotifications: Notifications | null;
let aircraftFlightsTableLayoutObserver: MutationObserver | null = null;
let aircraftFlightsTableLayoutTimer: number | undefined;
let aircraftFlightExtractionState: AESModel.FlightExtractionState = {
    failed: 0,
    message: '',
    opened: 0,
    running: false,
    tone: '',
    total: 0,
};
const AIRCRAFT_FLIGHTS_SCRIPT_ENABLED = AES.runContentScript("content_aircraftFlights", function() {
    AES.waitForElement(aircraftFlightsReadyTarget, initializeAircraftFlights, {
        scriptName: "content_aircraftFlights",
        errorMessage: "Aircraft flights insertion target was not found"
    });
});

function initializeAircraftFlights() {
    aircraftFlightData = getData();
    let currentAirline = AES.getCurrentAirline();
    aircraftFlightAirline = currentAirline && currentAirline.id ? currentAirline : AES.getAirline();
    aircraftFleetKey = aircraftFlightData.server + aircraftFlightAirline.id + 'aircraftFleet';
    aircraftFlightNotifications = typeof Notifications === 'function' ? new Notifications() : null;

    //Async start
    getStorageData();
}

function aircraftFlightsReadyTarget() {
    return $('#aircraft-flight-instances-table').length && $('h1 span').length;
}

if (AIRCRAFT_FLIGHTS_SCRIPT_ENABLED) {
    AES.whenPageOwnershipLost(function() {
        if (aircraftFlightsTableLayoutObserver) {
            aircraftFlightsTableLayoutObserver.disconnect();
            aircraftFlightsTableLayoutObserver = null;
        }
        clearTimeout(aircraftFlightsTableLayoutTimer);
        aircraftFlightsTableLayoutTimer = undefined;
        $('.aes-aircraft-flights-block').remove();
        $('.aes-aircraft-flights-extra-header, .aes-aircraft-flights-extra-cell').remove();
        clearFlightSequenceHighlights();
    });
}

function getStorageData() {
    let keys = [];
    for (let i = 0; i < aircraftFlightData.flights.length; i++) {
        let key = aircraftFlightData.server + 'flightInfo' + aircraftFlightData.flights[i].id;
        keys.push(key);
    }
    let flightPlanHubKey = aircraftFlightData.server + aircraftFlightAirline.id + 'aircraftFlightPlanHub' + aircraftFlightData.aircraftId;
    keys.push(flightPlanHubKey);
    chrome.storage.local.get(keys, function(result) {
        if (!storageCallbackSucceeded()) return;
        AES.tryRun("content_aircraftFlights", function() {
        const flightPlanHubData: unknown = result[flightPlanHubKey];
        if (
            AES.isRecord(flightPlanHubData) &&
            flightPlanHubData.type === 'aircraftFlightPlanHub' &&
            String(flightPlanHubData.aircraftId) === String(aircraftFlightData.aircraftId) &&
            typeof flightPlanHubData.hub === 'string' && flightPlanHubData.hub
        ) {
            aircraftFlightData.hubCounts = AES.isRecord(flightPlanHubData.counts) ? Object.fromEntries(Object.entries(flightPlanHubData.counts).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))) : {};
            aircraftFlightData.hubDetected = flightPlanHubData.hub;
            aircraftFlightData.hubEffective = flightPlanHubData.hub;
            aircraftFlightData.hubDetectionSource = 'flightPlan';
        }
        for (let flightInfo in result) {
            const stored: unknown = result[flightInfo];
            if (!AES.isRecord(stored) || !AES.isRecord(stored.money) ||
                !AES.isRecord(stored.money.CM5) || typeof stored.money.CM5.Total !== 'number' ||
                !Number.isFinite(stored.money.CM5.Total) || typeof stored.date !== 'string' || typeof stored.time !== 'string') {
                continue;
            }
            for (let i = 0; i < aircraftFlightData.flights.length; i++) {
                if (aircraftFlightData.flights[i].id == stored.flightId) {
                    aircraftFlightData.flights[i].data = { money: { CM5: { Total: stored.money.CM5.Total } }, date: stored.date, time: stored.time };
                }
            }
        }

        //Async
        getTotalProfit();
        });
    });
}

function getTotalProfit() {
    let profit = 0;
    let profitFlights = 0;
    aircraftFlightData.flights.forEach(function(value) {
        if (value.status == 'finished' || value.status == 'inflight') {
            let flightProfit = value.data && value.data.money && value.data.money.CM5 ? value.data.money.CM5.Total : null;
            if (flightProfit !== undefined && flightProfit !== null) {
                profit += flightProfit;
                profitFlights++;
            }
        }
    });
    aircraftFlightData.profit = profit;
    aircraftFlightData.profitFlights = profitFlights;
    //Async
    saveData();
}

function saveData() {
    syncFleetHubData(display);
}

function persistAircraftFlightSummary(callback?: () => void) {
    let key = aircraftFlightData.server + aircraftFlightData.type + aircraftFlightData.aircraftId;
    let saveData = {
        aircraftId: aircraftFlightData.aircraftId,
        date: aircraftFlightData.date,
        equipment: aircraftFlightData.equipment,
        finishedFlights: aircraftFlightData.finishedFlights,
        hubCounts: aircraftFlightData.hubCounts,
        hubDetected: aircraftFlightData.hubDetected,
        hubDetectionSource: aircraftFlightData.hubDetectionSource || 'flights',
        hubEffective: aircraftFlightData.hubEffective || aircraftFlightData.hubDetected,
        hubOverride: aircraftFlightData.hubOverride || '',
        profit: aircraftFlightData.profit,
        profitFlights: aircraftFlightData.profitFlights,
        registration: aircraftFlightData.registration,
        server: aircraftFlightData.server,
        time: aircraftFlightData.time,
        totalFlights: aircraftFlightData.totalFlights,
        type: aircraftFlightData.type,
    }
    chrome.storage.local.set({
        [key]: saveData }, function() {
        if (!storageCallbackSucceeded()) return;
        if (callback) {
            callback();
        }
    });
}

function display() {
    if (!AES.isPageOwner()) return;
    displayFlightProfit();
    let sequenceValidation = validateFlightSequence(aircraftFlightData.flights);
    highlightSequenceIssueFlights(sequenceValidation.issues);
    //Table
    let tableWell = $('<div class="as-table-well aes-aircraft-flights-summary aes-aircraft-flights-table"></div>').append(buildTable(sequenceValidation));
    let btn = $('<button type="button" class="btn btn-default aes-aircraft-flights-extract-btn"></button>').text('Extract all flight data');
    let btn1 = $('<button type="button" class="btn btn-default aes-aircraft-flights-extract-btn"></button>').text('Extract finished flight data');
    let saveOverrideBtn = $('<button type="button" class="btn btn-default"></button>').text('Save HUB override');
    let resetOverrideBtn = $('<button type="button" class="btn btn-default"></button>').text('Reset to default');
    let hubInput = $('<input type="text" class="form-control aes-aircraft-flights-hub-input" maxlength="3">').val((aircraftFlightData.hubOverride || '').slice(0, 3));
    let extractStatus = $('<span class="aes-aircraft-flights-extract-status" aria-live="polite"></span>');
    let toolbar = $('<div class="aes-aircraft-flights-toolbar aes-aircraft-flights-summary"></div>').append(
        $('<div class="aes-aircraft-flights-toolbar-row"></div>').append(
            $('<div class="aes-aircraft-flights-toolbar-group"></div>').append(
                $('<label class="control-label aes-aircraft-flights-toolbar-label"></label>').text('HUB'),
                $('<div class="aes-aircraft-flights-toolbar-controls"></div>').append(
                    hubInput,
                    $('<div class="btn-group aes-dashboard-control-actions"></div>').append(saveOverrideBtn, resetOverrideBtn)
                )
            ),
            $('<div class="aes-aircraft-flights-toolbar-group aes-aircraft-flights-toolbar-group-actions"></div>').append(
                $('<div class="btn-group aes-dashboard-control-actions aes-aircraft-flights-extract-actions"></div>').append(btn1, btn),
                extractStatus
            )
        )
    );
    //btn click
    btn.click(function() {
        startFlightProfitExtraction('all');
    });
    btn1.click(function() {
        startFlightProfitExtraction('finished');
    });
    saveOverrideBtn.click(function() {
        let override = String(hubInput.val() || '').trim().toUpperCase().slice(0, 3);
        if (!override) {
            showAircraftFlightsNotification('Enter a HUB code first', 'error');
            return;
        }
        updateHubOverride(override);
    });
    hubInput.on('input', function() {
        hubInput.val(String(hubInput.val() || '').trim().toUpperCase().slice(0, 3));
    });
    resetOverrideBtn.click(function() {
        hubInput.val('');
        resetHubOverride();
    });
    let content = $('<div class="aes-aircraft-flights-block"></div>').append(
        $('<div class="aes-aircraft-flights-title"></div>').text('AES Aircraft Flights'),
        toolbar,
        tableWell
    );
    $('.aes-aircraft-flights-block').remove();
    AES.markOwnedElements(content);
    let insertionTarget = $('#aircraft-flight-instances-table').closest('.as-table-well');
    if (insertionTarget.length) {
        insertionTarget.before(content);
        updateFlightExtractionDisplay();
        return;
    }

    let fallbackTarget = $('.as-page-aircraft > .row:first > .col-md-10:first');
    if (!fallbackTarget.length) {
        throw new Error("Aircraft flights insertion target was not found");
    }
    fallbackTarget.prepend(content);
    updateFlightExtractionDisplay();
}

async function startFlightProfitExtraction(type: 'all' | 'finished') {
    if (aircraftFlightExtractionState.running) {
        return;
    }

    const flights = getFlightsForProfitExtraction(type);
    if (!flights.length) {
        setFlightExtractionState({
            failed: 0,
            message: 'No matching flight data to extract.',
            opened: 0,
            running: false,
            tone: 'warning',
            total: 0,
        });
        showAircraftFlightsNotification('No matching flight data to extract.', 'warning');
        return;
    }

    setFlightExtractionState({
        failed: 0,
        message: 'Collecting flight data 0/' + flights.length + '...',
        opened: 0,
        running: true,
        tone: 'warning',
        total: flights.length,
    });

    try {
        const result = await extractAllFlightProfit(type, function(progress) {
            setFlightExtractionState({
                failed: progress.failed,
                message: 'Collecting flight data ' + progress.opened + '/' + progress.total + (progress.failed ? ' (' + progress.failed + ' failed)' : '') + '...',
                opened: progress.opened,
                running: true,
                tone: 'warning',
                total: progress.total,
            });
        });

        if (result.failed) {
            setFlightExtractionState({
                failed: result.failed,
                message: 'Collected ' + result.opened + '/' + result.total + ' flights. Retry the failed items.',
                opened: result.opened,
                running: false,
                tone: 'warning',
                total: result.total,
            });
            showAircraftFlightsNotification('Some flight data could not be collected.', 'warning');
            return;
        }

        setFlightExtractionState({
            failed: 0,
            message: 'Collected ' + result.opened + ' flights. Profit data refreshed.',
            opened: result.opened,
            running: false,
            tone: 'good',
            total: result.total,
        });
        showAircraftFlightsNotification('Flight data collected. Profit data refreshed.', 'success');
    } catch (error) {
        setFlightExtractionState({
            failed: 0,
            message: 'Flight data extraction failed. Try again.',
            opened: 0,
            running: false,
            tone: 'bad',
            total: flights.length,
        });
        showAircraftFlightsNotification('Flight data extraction failed.', 'error');
        console.error('[AES] Flight data extraction failed', error);
    }
}

function setFlightExtractionState(nextState: Partial<AESModel.FlightExtractionState>) {
    aircraftFlightExtractionState = Object.assign({}, aircraftFlightExtractionState, nextState);
    updateFlightExtractionDisplay();
}

function updateFlightExtractionDisplay() {
    if (!AES.isPageOwner()) return;
    $('.aes-aircraft-flights-extract-btn').prop('disabled', aircraftFlightExtractionState.running);
    $('.aes-aircraft-flights-extract-status')
        .removeClass('good bad warning')
        .addClass(aircraftFlightExtractionState.tone || '')
        .text(aircraftFlightExtractionState.message || '');
}

function getFlightsForProfitExtraction(type: 'all' | 'finished') {
    return aircraftFlightData.flights.filter(function(value) {
        if (type !== 'finished') {
            return true;
        }
        return value.status === 'finished' || value.status === 'inflight';
    });
}

async function extractAllFlightProfit(type: 'all' | 'finished', progressCallback?: (progress: AESModel.FlightExtractionProgress) => void) {
    const flights = getFlightsForProfitExtraction(type);
    const current = AESRead.context();
    let failed = 0;
    let lastError = '';
    let opened = 0;

    for (let i = 0; i < flights.length; i++) {
        if (!current()) throw new Error('Page ownership or airline changed');
        const url = getFlightInfoUrl(flights[i]);
        const result = await collectFlightInfoPage(url, flights[i].id, current);

        if (result.ok) {
            opened++;
        } else {
            failed++;
            lastError = result.error || lastError;
        }

        if (progressCallback) {
            progressCallback({
                failed: failed,
                lastError: lastError,
                opened: opened,
                total: flights.length,
            });
        }

    }

    if (current()) getStorageData();
    return {
        failed: failed,
        lastError: lastError,
        opened: opened,
        total: flights.length,
    };
}

function getFlightInfoUrl(flight: AESModel.AircraftFlight) {
    return 'https://' + aircraftFlightData.server + '.airlinesim.aero/action/info/flight?id=' + flight.id;
}

async function collectFlightInfoPage(url: string, id: number, current: () => boolean): Promise<AESModel.TabOpenResult> {
    try {
        const doc = await AESRead.fetchDocument(url,current);
        const data = AESRead.flight(doc,id);
        if (!current()) throw new Error('Page ownership or airline changed');
        await chrome.storage.local.set({[data.server+'flightInfo'+id]:data});
        return {ok: true};
    } catch (error) {
        return {ok: false, error: error instanceof Error ? error.message : String(error)};
    }
}

function displayFlightProfit() {
    //Table
    let table = $('#aircraft-flight-instances-table');
    //Head
    $('.aes-aircraft-flights-extra-header, .aes-aircraft-flights-extra-cell', table).remove();
    let th = ['<th class="aes-aircraft-flights-extra-header">Profit/Loss</th>', '<th class="aes-aircraft-flights-extra-header">Extract date</th>'];
    let headerAnchor = $('thead tr', table).first().children('th').last();
    headerAnchor.before(...th);
    //body
    aircraftFlightData.flights.forEach(function(value) {
        let td = [];

        if (value.data) {
            td.push($(formatMoney(value.data.money.CM5.Total)).addClass('aes-aircraft-flights-extra-cell'));
            td.push($('<td class="aes-aircraft-flights-extra-cell"></td>').text(AES.formatDateString(value.data.date) + ' ' + value.data.time));
        } else {
            td.push('<td class="aes-aircraft-flights-extra-cell text-center">--</td>');
            td.push('<td class="aes-aircraft-flights-extra-cell text-center">--</td>');
        }

        let detailsCell = $('a[href*="action/info/flight"]', value.row).closest('td').first();
        if (detailsCell.length) {
            detailsCell.before(...td);
        }
    });
    $('tbody tr', table).each(function() {
        let row = $(this);
        if (row.children('.aes-aircraft-flights-extra-cell').length) {
            return;
        }
        let detailsCell = $('a[href*="action/info/flight"]', row).closest('td').first();
        let anchor = detailsCell.length ? detailsCell : row.children('td').last();
        if (anchor.length) {
            anchor.before(
                '<td class="aes-aircraft-flights-extra-cell text-center">--</td>',
                '<td class="aes-aircraft-flights-extra-cell text-center">--</td>'
            );
        }
    });
    AES.markOwnedElements($('.aes-aircraft-flights-extra-header, .aes-aircraft-flights-extra-cell', table));
    reconcileAircraftFlightsTableLayout();
    watchAircraftFlightsTableLayout();
}

function getAircraftFlightsLogicalColumnCount(row: HTMLElement) {
    return $(row).children<HTMLTableCellElement>('th, td').toArray().reduce(function(total, cell) {
        return total + (cell.colSpan || 1);
    }, 0);
}

function reconcileAircraftFlightsTableLayout() {
    if (!AES.isPageOwner()) return;
    let table = $('#aircraft-flight-instances-table');
    if (!table.length) {
        return;
    }

    let headerRow = $('thead tr', table).first();
    let headerAnchor = headerRow.children('th').last();
    let headers = headerRow.children('.aes-aircraft-flights-extra-header');
    if (headerAnchor.length && headers.length && headers.last().next()[0] !== headerAnchor[0]) {
        headerAnchor.before(headers);
    }

    $('tbody tr', table).each(function() {
        let row = $(this);
        let detailsCell = $('a[href*="action/info/flight"]', row).closest('td').first();
        let aesCells = row.children('.aes-aircraft-flights-extra-cell');
        if (detailsCell.length && aesCells.length && aesCells.last().next()[0] !== detailsCell[0]) {
            detailsCell.before(aesCells);
        }
    });

    let columnCount = 0;
    $('thead tr, tbody tr', table).each(function() {
        columnCount = Math.max(columnCount, getAircraftFlightsLogicalColumnCount(this));
    });
    if (columnCount) {
        $('tfoot tr', table).each(function() {
            let footerCells = $(this).children('th, td');
            if (footerCells.length === 1 && String(footerCells.attr('colspan') || '') !== String(columnCount)) {
                footerCells.attr('colspan', columnCount);
            }
        });
    }
}

function watchAircraftFlightsTableLayout() {
    let table = document.querySelector('#aircraft-flight-instances-table');
    if (!table || typeof MutationObserver === 'undefined') {
        return;
    }

    if (aircraftFlightsTableLayoutObserver) {
        aircraftFlightsTableLayoutObserver.disconnect();
    }
    aircraftFlightsTableLayoutObserver = new MutationObserver(function() {
        clearTimeout(aircraftFlightsTableLayoutTimer);
        aircraftFlightsTableLayoutTimer = window.setTimeout(function() {
            reconcileAircraftFlightsTableLayout();
        }, 0);
    });
    aircraftFlightsTableLayoutObserver.observe(table, {
        attributeFilter: ['colspan'],
        attributes: true,
        childList: true,
        subtree: true,
    });
}

function buildTable(sequenceValidation: AESModel.FlightSequenceValidation) {
    let totalProfitCell = $(formatMoney(aircraftFlightData.profit));
    let row = [];
    row.push($('<tr></tr>').append(
        $('<th></th>').text('Aircraft Id'),
        $('<td></td>').text(aircraftFlightData.aircraftId),
        $('<th></th>').text('Total flights'),
        $('<td></td>').text(aircraftFlightData.totalFlights)
    ));
    row.push($('<tr></tr>').append(
        $('<th></th>').text('Registration'),
        $('<td></td>').text(aircraftFlightData.registration),
        $('<th></th>').text('Finished flights'),
        $('<td></td>').text(aircraftFlightData.finishedFlights)
    ));
    row.push($('<tr></tr>').append(
        $('<th></th>').text('Detected HUB'),
        $('<td id="aes-aircraft-hub-detected"></td>').text(aircraftFlightData.hubDetected || '--'),
        $('<th></th>').text('Total aircraft profit/loss'),
        $('<td class="aes-text-right aes-no-text-wrap"></td>').append(totalProfitCell.contents())
    ));
    row.push($('<tr></tr>').append(
        $('<th></th>').text('Override HUB'),
        $('<td id="aes-aircraft-hub-override"></td>').text(aircraftFlightData.hubOverride || '--'),
        $('<th></th>').text('Sequence check'),
        buildSequenceValidationCell(sequenceValidation)
    ));
    row.push($('<tr></tr>').append(
        $('<th></th>').text('Current HUB'),
        $('<td id="aes-aircraft-hub-effective"></td>').text(aircraftFlightData.hubEffective || aircraftFlightData.hubDetected || '--'),
        $('<th></th>').text('Data save time'),
        $('<td></td>').text(AES.formatDateString(aircraftFlightData.date) + ' ' + aircraftFlightData.time)
    ));

    let tbody = $('<tbody></tbody>').append(...row);
    return $('<table class="table table-bordered table-striped table-hover"></table>').append(tbody);
}

function buildSequenceValidationCell(validation: AESModel.FlightSequenceValidation) {
    const statusClass = validation.issueCount ? 'bad' : (validation.checkedCount ? 'good' : 'warning');
    const statusText = validation.issueCount
        ? validation.issueCount + ' issue' + (validation.issueCount === 1 ? '' : 's') + ' found'
        : (validation.checkedCount ? 'Valid sequence' : 'No timed flights to check');

    const cell = $('<td class="aes-aircraft-flights-sequence-cell"></td>').append(
        $('<span></span>').addClass(statusClass).text(statusText),
        $('<span class="aes-aircraft-flights-sequence-checked"></span>').text(' · ' + validation.checkedCount + ' checked')
    );

    if (validation.issues.length) {
        cell.append(buildSequenceIssueList(validation.issues));
    }

    return cell;
}

function buildSequenceIssueList(issues: AESModel.FlightSequenceIssue[]) {
    const list = $('<ol class="aes-aircraft-flights-sequence-list"></ol>');
    const maxVisibleIssues = 10;
    issues.slice(0, maxVisibleIssues).forEach(function(issue) {
        list.append($('<li></li>').text(issue.message));
    });
    if (issues.length > maxVisibleIssues) {
        list.append($('<li></li>').text((issues.length - maxVisibleIssues) + ' more issue(s) not shown.'));
    }
    return list;
}

function validateFlightSequence(flights: AESModel.AircraftFlight[]) {
    const issues: AESModel.FlightSequenceIssue[] = [];
    const checkedFlights = flights.filter(function(flight) {
        return !isCancelledFlight(flight);
    });

    checkedFlights.forEach(function(flight) {
        if (!flight.origin) {
            issues.push(createFlightSequenceIssue(flight, null, 'Missing departure airport.'));
        }
        if (!flight.destination) {
            issues.push(createFlightSequenceIssue(flight, null, 'Missing arrival airport.'));
        }
        if (flight.departureTime === null) {
            issues.push(createFlightSequenceIssue(flight, null, 'Missing or unreadable departure time.'));
        }
        if (flight.arrivalTime === null) {
            issues.push(createFlightSequenceIssue(flight, null, 'Missing or unreadable arrival time.'));
        }
        if (flight.departureTime !== null && flight.arrivalTime !== null && flight.departureTime >= flight.arrivalTime) {
            issues.push(createFlightSequenceIssue(flight, null, 'Arrival time is not after departure time.'));
        }
    });

    const sortedFlights = checkedFlights.slice().filter(function(flight) {
        return flight.departureTime !== null && flight.arrivalTime !== null;
    }).sort(function(a, b) {
        return (a.departureTime ?? 0) - (b.departureTime ?? 0);
    });

    for (let i = 1; i < sortedFlights.length; i++) {
        const previousFlight = sortedFlights[i - 1];
        const currentFlight = sortedFlights[i];

        if (previousFlight.destination && currentFlight.origin && previousFlight.destination !== currentFlight.origin) {
            issues.push(createFlightSequenceIssue(previousFlight, currentFlight, 'Next departure airport ' + currentFlight.origin + ' does not match previous arrival airport ' + previousFlight.destination + '.'));
        }

        if (currentFlight.departureTime !== null && previousFlight.arrivalTime !== null && currentFlight.departureTime <= previousFlight.arrivalTime) {
            issues.push(createFlightSequenceIssue(previousFlight, currentFlight, 'Next flight does not depart after the previous flight arrives.'));
        }
    }

    return {
        checkedCount: checkedFlights.length,
        issueCount: issues.length,
        issues: issues,
    };
}

function createFlightSequenceIssue(previousFlight: AESModel.AircraftFlight, currentFlight: AESModel.AircraftFlight | null, message: string) {
    let label = getFlightSequenceLabel(previousFlight);
    let issueFlights = [];
    if (previousFlight) {
        issueFlights.push(previousFlight);
    }
    if (currentFlight) {
        label += ' -> ' + getFlightSequenceLabel(currentFlight);
        issueFlights.push(currentFlight);
    }
    return {
        flights: issueFlights,
        message: label + ': ' + message
    };
}

function isCancelledFlight(flight: AESModel.AircraftFlight) {
    const status = String(flight && flight.status ? flight.status : '').trim().toLowerCase();
    return status === 'cancelled' || status === 'canceled';
}

function clearFlightSequenceHighlights() {
    $('.aes-aircraft-flights-sequence-issue-row').removeClass('aes-aircraft-flights-sequence-issue-row');
}

function highlightSequenceIssueFlights(issues: AESModel.FlightSequenceIssue[]) {
    clearFlightSequenceHighlights();
    issues.forEach(function(issue) {
        (issue.flights || []).forEach(function(flight) {
            if (flight.row && flight.row.length) {
                flight.row.addClass('aes-aircraft-flights-sequence-issue-row');
            }
        });
    });
}

function getFlightSequenceLabel(flight: AESModel.AircraftFlight) {
    if (!flight) {
        return 'Unknown flight';
    }
    return (flight.flightNumber || ('Flight ' + flight.id)) + ' (' + (flight.departureText || '?') + ' ' + (flight.origin || '?') + ' -> ' + (flight.arrivalText || '?') + ' ' + (flight.destination || '?') + ')';
}

function getData(): AESModel.AircraftFlightData {
    //Aircraft ID
    let aircraftId = getAircraftId();
    let aircraftInfo = getAircraftInfo();
    let date = AES.getServerDate()
    let server = AES.getServerName();
    let flights = getFlights(date.date);
    let flightsStats = getFlightsStats(flights);
    let hubStats = getHubStats(flights);
    return {
        server: server,
        aircraftId: aircraftId,
        type: 'aircraftFlights',
        date: date.date,
        time: date.time,
        registration: aircraftInfo.registration,
        equipment: aircraftInfo.equipment,
        flights: flights,
        finishedFlights: flightsStats.finishedFlights,
        totalFlights: flightsStats.totalFlights,
        hubCounts: hubStats.counts,
        hubDetected: hubStats.hub,
        hubDetectionSource: 'flights',
        hubEffective: hubStats.hub,
        hubOverride: '',
        profit: 0,
        profitFlights: 0
    }
}

function getFlightsStats(flights: AESModel.AircraftFlight[]) {
    let finished = 0, total = 0;
    flights.forEach(function(value) {
        if (value.status == 'finished' || value.status == 'inflight') {
            finished++;
        }
        total++;
    });
    return {
        totalFlights: total,
        finishedFlights: finished
    }
}

/**
 * Get the data from “flights” table
 * @param {string} serverDate
 * @returns {array} flights
 */
function getFlights(serverDate: string) {
    const table = document.querySelector("#aircraft-flight-instances-table")
    if (!table) {
        throw new Error("Aircraft flights table #aircraft-flight-instances-table was not found")
    }
    const rows = table.querySelectorAll<HTMLTableRowElement>("tbody tr")
    const flights: AESModel.AircraftFlight[] = []

    for (const row of rows) {
        const flightNumber = row.querySelector<HTMLElement>("td:nth-child(2)")?.innerText.trim()
        if (flightNumber === "XFER" || flightNumber === undefined) {
            continue
        }
        const url = row.querySelector<HTMLAnchorElement>(`[href*="action/info/flight"]`)?.href
        if (!url) {
            continue
        }

        const idMatch = url.match(/[?&]id=(\d+)(?:[&#]|$)/);
        if (!idMatch) continue;
        const flight: AESModel.AircraftFlight = {
            arrivalTime: null, arrivalText: '', departureTime: null, departureText: '',
            destination: '', origin: '', flightNumber, status: '',
            id: parseInt(idMatch[1], 10), row: $(row)
        };
        flight.status = row.querySelector<HTMLElement>(".flightStatusPanel")?.innerText.trim() || ''
        flight.flightNumber = flightNumber
        flight.origin = row.querySelector<HTMLElement>("td:nth-child(3) span:last-child")?.innerText.trim() || ''
        flight.destination = row.querySelector<HTMLElement>("td:nth-child(5) span:last-child")?.innerText.trim() || ''
        flight.departureText = getFlightTimeText(row, 4)
        flight.arrivalText = getFlightTimeText(row, 6)
        flight.departureTime = parseAircraftFlightUtcTime(flight.departureText, serverDate)
        flight.arrivalTime = parseAircraftFlightUtcTime(flight.arrivalText, serverDate)
        flight.row = $(row)
        flights.push(flight)
    }

    return flights
}

function getFlightTimeText(row: HTMLTableRowElement, cellIndex: number) {
    const cell = row.querySelector("td:nth-child(" + cellIndex + ")")
    const span = cell ? cell.querySelector("span") : null
    if (!span) {
        return ''
    }

    const title = span.getAttribute("title") || ''
    const titleUtc = title.split('/').map(function(value) {
        return value.trim()
    }).find(function(value) {
        return /\bUTC\b/i.test(value)
    })
    return titleUtc || span.innerText.trim()
}

function parseAircraftFlightUtcTime(value: string, serverDate: string) {
    const match = String(value || '').match(/(\d{1,2})\.(\d{1,2})\.\s+(\d{1,2}):(\d{2})\s+UTC/i)
    if (!match || !serverDate) {
        return null
    }

    const serverYear = parseInt(String(serverDate).substring(0, 4), 10)
    const serverMonth = parseInt(String(serverDate).substring(4, 6), 10)
    const serverDay = parseInt(String(serverDate).substring(6, 8), 10)
    let year = serverYear
    const day = parseInt(match[1], 10)
    const month = parseInt(match[2], 10)
    const hours = parseInt(match[3], 10)
    const minutes = parseInt(match[4], 10)
    let parsed = Date.UTC(year, month - 1, day, hours, minutes)
    const serverTime = Date.UTC(serverYear, serverMonth - 1, serverDay, 12, 0)
    const halfYear = 183 * 24 * 60 * 60 * 1000

    if (parsed - serverTime > halfYear) {
        year--
        parsed = Date.UTC(year, month - 1, day, hours, minutes)
    } else if (serverTime - parsed > halfYear) {
        year++
        parsed = Date.UTC(year, month - 1, day, hours, minutes)
    }

    const date = new Date(parsed)
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day ||
        date.getUTCHours() !== hours ||
        date.getUTCMinutes() !== minutes
    ) {
        return null
    }

    return parsed
}

function getHubStats(flights: AESModel.AircraftFlight[]) {
    let counts: Record<string, number> = {};
    flights.forEach(function(flight) {
        [flight.origin, flight.destination].forEach(function(airport) {
            if (!airport) {
                return;
            }
            if (!counts[airport]) {
                counts[airport] = 0;
            }
            counts[airport]++;
        });
    });

    let hub = '';
    Object.keys(counts).sort(function(a, b) {
        if (counts[b] == counts[a]) {
            return a.localeCompare(b);
        }
        return counts[b] - counts[a];
    }).some(function(airport) {
        hub = airport;
        return true;
    });

    return {
        counts: counts,
        hub: hub
    };
}

function syncFleetHubData(callback: () => void) {
    resolveAircraftFleetMatches(function(matches) {
        let changed = false;

        matches.forEach(function(match) {
            if ((match.aircraft.hubDetected || '') != (aircraftFlightData.hubDetected || '')) {
                match.aircraft.hubDetected = aircraftFlightData.hubDetected || '';
                changed = true;
            }
            if ((match.aircraft.hubDetectionSource || '') != (aircraftFlightData.hubDetectionSource || 'flights')) {
                match.aircraft.hubDetectionSource = aircraftFlightData.hubDetectionSource || 'flights';
                changed = true;
            }
            if (!match.aircraft.hubOverride && (match.aircraft.hubEffective || '') != (match.aircraft.hubDetected || '')) {
                match.aircraft.hubEffective = match.aircraft.hubDetected || '';
                changed = true;
            }
        });

        if (matches.length) {
            aircraftFlightData.hubOverride = matches[0].aircraft.hubOverride || '';
            aircraftFlightData.hubEffective = matches[0].aircraft.hubOverride || matches[0].aircraft.hubEffective || matches[0].aircraft.hubDetected || aircraftFlightData.hubDetected || '';
        } else {
            aircraftFlightData.hubOverride = '';
            aircraftFlightData.hubEffective = aircraftFlightData.hubDetected || '';
        }

        let finish = function() {
            persistAircraftFlightSummary(callback);
        };

        if (changed && matches.length) {
            let pending = matches.length;
            matches.forEach(function(match) {
                chrome.storage.local.set({ [match.key]: match.fleetData }, function() {
                    if (!storageCallbackSucceeded()) return;
                    pending--;
                    if (!pending) {
                        finish();
                    }
                });
            });
            return;
        }

        finish();
    });
}

function updateHubOverride(override: string) {
    resolveAircraftFleetMatches(function(matches) {
        if (!matches.length) {
            showAircraftFlightsNotification('Extract fleet data first', 'error');
            return;
        }

        let pending = matches.length;
        matches.forEach(function(match) {
            match.aircraft.hubOverride = override;
            match.aircraft.hubEffective = override;
            chrome.storage.local.set({ [match.key]: match.fleetData }, function() {
                if (!storageCallbackSucceeded()) return;
                pending--;
                if (!pending) {
                    aircraftFlightData.hubOverride = override;
                    aircraftFlightData.hubEffective = override;
                    persistAircraftFlightSummary(function() {
                        refreshHubSummary();
                        showAircraftFlightsNotification('HUB override saved', 'success');
                    });
                }
            });
        });
    });
}

function resetHubOverride() {
    resolveAircraftFleetMatches(function(matches) {
        if (!matches.length) {
            showAircraftFlightsNotification('Extract fleet data first', 'error');
            return;
        }

        let pending = matches.length;
        matches.forEach(function(match) {
            match.aircraft.hubOverride = '';
            match.aircraft.hubEffective = match.aircraft.hubDetected || aircraftFlightData.hubDetected || '';
            chrome.storage.local.set({ [match.key]: match.fleetData }, function() {
                if (!storageCallbackSucceeded()) return;
                pending--;
                if (!pending) {
                    aircraftFlightData.hubOverride = '';
                    aircraftFlightData.hubEffective = aircraftFlightData.hubDetected || '';
                    persistAircraftFlightSummary(function() {
                        refreshHubSummary();
                        showAircraftFlightsNotification('Reset to detected HUB', 'success');
                    });
                }
            });
        });
    });
}

function showAircraftFlightsNotification(message: string, type: AESModel.NotificationType) {
    if (AES.isPageOwner() && aircraftFlightNotifications) {
        aircraftFlightNotifications.add(message, { type: type });
    }
}

function refreshHubSummary() {
    $('#aes-aircraft-hub-detected').text(aircraftFlightData.hubDetected || '--');
    $('#aes-aircraft-hub-override').text(aircraftFlightData.hubOverride || '--');
    $('#aes-aircraft-hub-effective').text(aircraftFlightData.hubEffective || aircraftFlightData.hubDetected || '--');
}

function resolveAircraftFleetMatches(callback: (matches: AESModel.AircraftFleetMatch[]) => void) {
    chrome.storage.local.get([aircraftFleetKey], function(result) {
        if (!storageCallbackSucceeded()) return;
        let matches: AESModel.AircraftFleetMatch[] = [];
        let fleetData = AES.readFleetRecord(result[aircraftFleetKey]);
        if (fleetData && Array.isArray(fleetData.fleet)) {
            let aircraft = fleetData.fleet.find(function(item) {
                return item.aircraftId == aircraftFlightData.aircraftId;
            }) || null;
            if (aircraft) {
                matches.push({
                    key: aircraftFleetKey,
                    fleetData: fleetData,
                    aircraft: aircraft
                });
            }
        }
        callback(matches);
    });
}

function getAircraftInfo() {
    let span = $('h1 span');
    return {
        registration: $(span[0]).text().trim(),
        equipment: $(span[1]).text().trim()
    }
}

function getAircraftId() {
    let url = window.location.pathname;
    let a = url.split('/');
    return parseInt(a[a.length - 2], 10);
}

function formatMoney(value: number) {
    let container = document.createElement("td")
    let formattedValue = Intl.NumberFormat().format(value)
    let indicatorEl = document.createElement("span")
    let valueEl = document.createElement("span")
    let currencyEl = document.createElement("span")

    if (value >= 0) {
        valueEl.classList.add("good")
        indicatorEl.innerText = "+"
    }

    if (value < 0) {
        valueEl.classList.add("bad")
        indicatorEl.innerText = "-"
        formattedValue = formattedValue.replace("-", "")
    }

    valueEl.innerText = formattedValue
    currencyEl.innerText = " AS$"

    container.classList.add("aes-text-right", "aes-no-text-wrap")
    container.append(indicatorEl, valueEl, currencyEl)

    return container
}

function storageCallbackSucceeded() {
    const error = chrome.runtime.lastError;
    if (!AES.isPageOwner()) return false;
    if (error) {
        AES.reportContentScriptError('content_aircraftFlights', new Error(error.message));
        showAircraftFlightsNotification('Aircraft data could not be read or saved. Please retry or reload.', 'error');
        return false;
    }
    return true;
}
})();
