"use strict";
//MAIN
//Global vars
var aircraftFlightData;
var aircraftFlightAirline;
var aircraftFleetKey;
var aircraftFlightNotifications;
var aircraftFlightExtractionState = {
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
    persistAircraftFlightSummary();
    syncFleetHubData(function() {});

    //Async start
    getStorageData();
}

function aircraftFlightsReadyTarget() {
    return $('#aircraft-flight-instances-table').length && $('h1 span').length;
}

if (AIRCRAFT_FLIGHTS_SCRIPT_ENABLED) {
    AES.whenPageOwnershipLost(function() {
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
    chrome.storage.local.get(keys, function(result) {
        AES.tryRun("content_aircraftFlights", function() {
        for (let flightInfo in result) {
            if (!result[flightInfo]) {
                continue;
            }
            for (let i = 0; i < aircraftFlightData.flights.length; i++) {
                if (aircraftFlightData.flights[i].id == result[flightInfo].flightId) {
                    aircraftFlightData.flights[i].data = result[flightInfo];
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
    persistAircraftFlightSummary(function() {
        syncFleetHubData(display);
    });
}

function persistAircraftFlightSummary(callback) {
    let key = aircraftFlightData.server + aircraftFlightData.type + aircraftFlightData.aircraftId;
    let saveData = {
        aircraftId: aircraftFlightData.aircraftId,
        date: aircraftFlightData.date,
        equipment: aircraftFlightData.equipment,
        finishedFlights: aircraftFlightData.finishedFlights,
        hubCounts: aircraftFlightData.hubCounts,
        hubDetected: aircraftFlightData.hubDetected,
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
        if (callback) {
            callback();
        }
    });
}

function display() {
    displayFlightProfit();
    //Table
    let tableWell = $('<div class="as-table-well aes-aircraft-flights-summary aes-aircraft-flights-table"></div>').append(buildTable());
    let sequencePanel = buildSequenceValidationPanel();
    let btn = $('<button type="button" class="btn btn-default aes-aircraft-flights-extract-btn"></button>').text('Download all flight data');
    let btn1 = $('<button type="button" class="btn btn-default aes-aircraft-flights-extract-btn"></button>').text('Download finished flight data');
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
                $('<div class="btn-group aes-dashboard-control-actions"></div>').append(btn1, btn),
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
        let override = hubInput.val().trim().toUpperCase().slice(0, 3);
        if (!override) {
            showAircraftFlightsNotification('Enter a HUB code first', 'error');
            return;
        }
        updateHubOverride(override);
    });
    hubInput.on('input', function() {
        hubInput.val(hubInput.val().trim().toUpperCase().slice(0, 3));
    });
    resetOverrideBtn.click(function() {
        hubInput.val('');
        resetHubOverride();
    });
    let content = $('<div class="aes-aircraft-flights-block"></div>').append(
        $('<div class="aes-aircraft-flights-title"></div>').text('AES Aircraft Flights'),
        toolbar,
        tableWell,
        sequencePanel
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

async function startFlightProfitExtraction(type) {
    if (aircraftFlightExtractionState.running) {
        return;
    }

    const flights = getFlightsForProfitExtraction(type);
    if (!flights.length) {
        setFlightExtractionState({
            failed: 0,
            message: 'No matching flight data to download.',
            opened: 0,
            running: false,
            tone: 'warning',
            total: 0,
        });
        showAircraftFlightsNotification('No matching flight data to download.', 'warning');
        return;
    }

    setFlightExtractionState({
        failed: 0,
        message: 'Opening flight data pages 0/' + flights.length + '...',
        opened: 0,
        running: true,
        tone: 'warning',
        total: flights.length,
    });

    try {
        const result = await extractAllFlightProfit(type, function(progress) {
            setFlightExtractionState({
                failed: progress.failed,
                message: 'Opening flight data pages ' + progress.opened + '/' + progress.total + (progress.failed ? ' (' + progress.failed + ' failed)' : '') + '...',
                opened: progress.opened,
                running: true,
                tone: 'warning',
                total: progress.total,
            });
        });

        if (result.failed) {
            setFlightExtractionState({
                failed: result.failed,
                message: 'Opened ' + result.opened + '/' + result.total + ' flight data pages. Allow pop-ups and try again if any are missing.',
                opened: result.opened,
                running: false,
                tone: 'warning',
                total: result.total,
            });
            showAircraftFlightsNotification('Some flight data pages could not be opened.', 'warning');
            return;
        }

        setFlightExtractionState({
            failed: 0,
            message: 'Opened ' + result.opened + ' flight data pages. Reload this page after they finish.',
            opened: result.opened,
            running: false,
            tone: 'good',
            total: result.total,
        });
        showAircraftFlightsNotification('Please reload page after all flight info pages open', 'warning');
    } catch (error) {
        setFlightExtractionState({
            failed: 0,
            message: 'Flight data download failed. Try again.',
            opened: 0,
            running: false,
            tone: 'bad',
            total: flights.length,
        });
        showAircraftFlightsNotification('Flight data download failed.', 'error');
        console.error('[AES] Flight data download failed', error);
    }
}

function setFlightExtractionState(nextState) {
    aircraftFlightExtractionState = Object.assign({}, aircraftFlightExtractionState, nextState);
    updateFlightExtractionDisplay();
}

function updateFlightExtractionDisplay() {
    $('.aes-aircraft-flights-extract-btn').prop('disabled', aircraftFlightExtractionState.running);
    $('.aes-aircraft-flights-extract-status')
        .removeClass('good bad warning')
        .addClass(aircraftFlightExtractionState.tone || '')
        .text(aircraftFlightExtractionState.message || '');
}

function getFlightsForProfitExtraction(type) {
    return aircraftFlightData.flights.filter(function(value) {
        if (type !== 'finished') {
            return true;
        }
        return value.status === 'finished' || value.status === 'inflight';
    });
}

async function extractAllFlightProfit(type, progressCallback) {
    const flights = getFlightsForProfitExtraction(type);
    let failed = 0;
    let lastError = '';
    let opened = 0;

    for (let i = 0; i < flights.length; i++) {
        const url = getFlightInfoUrl(flights[i]);
        const result = await openFlightInfoPage(url);

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

        if (i < flights.length - 1) {
            await AES.sleep(30 + Math.floor(Math.random() * 41));
        }
    }

    return {
        failed: failed,
        lastError: lastError,
        opened: opened,
        total: flights.length,
    };
}

function getFlightInfoUrl(flight) {
    return 'https://' + aircraftFlightData.server + '.airlinesim.aero/action/info/flight?id=' + flight.id;
}

async function openFlightInfoPage(url) {
    const backgroundResult = await requestBackgroundTabOpen(url);
    if (backgroundResult.ok) {
        return backgroundResult;
    }

    const openedWindow = window.open(url, '_blank');
    if (openedWindow) {
        return { ok: true, method: 'window.open' };
    }

    return {
        error: backgroundResult.error || 'The browser blocked the new tab.',
        ok: false,
    };
}

function requestBackgroundTabOpen(url) {
    return new Promise(function(resolve) {
        if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
            resolve({
                error: 'Extension runtime is unavailable.',
                ok: false,
            });
            return;
        }

        chrome.runtime.sendMessage({
            active: false,
            type: 'AES_OPEN_TAB',
            url: url,
        }, function(response) {
            if (chrome.runtime.lastError) {
                resolve({
                    error: chrome.runtime.lastError.message,
                    ok: false,
                });
                return;
            }

            resolve(response || {
                error: 'No tab open response.',
                ok: false,
            });
        });
    });
}

function displayFlightProfit() {
    //Table
    let table = $('#aircraft-flight-instances-table');
    //Head
    $('.aes-aircraft-flights-extra-header, .aes-aircraft-flights-extra-cell', table).remove();
    let th = ['<th class="aes-aircraft-flights-extra-header">Profit/Loss</th>', '<th class="aes-aircraft-flights-extra-header">Extract date</th>'];
    $('th:eq(9)', table).after(th);
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

        $('td:eq(11)', value.row).after(td);
    });
    AES.markOwnedElements($('.aes-aircraft-flights-extra-header, .aes-aircraft-flights-extra-cell', table));
    $("tfoot td", table).attr("colspan", "15")
}

function buildTable() {
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
        $('<th></th>').text('Data save time'),
        $('<td></td>').text(AES.formatDateString(aircraftFlightData.date) + ' ' + aircraftFlightData.time)
    ));
    row.push($('<tr></tr>').append(
        $('<th></th>').text('Current HUB'),
        $('<td id="aes-aircraft-hub-effective"></td>').text(aircraftFlightData.hubEffective || aircraftFlightData.hubDetected || '--'),
        $('<th></th>'),
        $('<td></td>')
    ));

    let tbody = $('<tbody></tbody>').append(row);
    return $('<table class="table table-bordered table-striped table-hover"></table>').append(tbody);
}

function buildSequenceValidationPanel() {
    const validation = validateFlightSequence(aircraftFlightData.flights);
    highlightSequenceIssueFlights(validation.issues);
    const statusClass = validation.issueCount ? 'bad' : (validation.checkedCount ? 'good' : 'warning');
    const statusText = validation.issueCount
        ? validation.issueCount + ' issue' + (validation.issueCount === 1 ? '' : 's') + ' found'
        : (validation.checkedCount ? 'Valid sequence' : 'No timed flights to check');

    let rows = [];
    rows.push($('<tr></tr>').append(
        $('<th></th>').text('Sequence check'),
        $('<td></td>').append($('<span></span>').addClass(statusClass).text(statusText)),
        $('<th></th>').text('Checked flights'),
        $('<td></td>').text(validation.checkedCount)
    ));

    if (validation.issues.length) {
        rows.push($('<tr></tr>').append(
            $('<th></th>').text('Issues'),
            $('<td colspan="3"></td>').append(buildSequenceIssueList(validation.issues))
        ));
    }

    return $('<div class="as-table-well aes-aircraft-flights-summary aes-aircraft-flights-sequence"></div>').append(
        $('<table class="table table-bordered table-striped table-hover"></table>').append($('<tbody></tbody>').append(rows))
    );
}

function buildSequenceIssueList(issues) {
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

function validateFlightSequence(flights) {
    const issues = [];
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
        return a.departureTime - b.departureTime;
    });

    for (let i = 1; i < sortedFlights.length; i++) {
        const previousFlight = sortedFlights[i - 1];
        const currentFlight = sortedFlights[i];

        if (previousFlight.destination && currentFlight.origin && previousFlight.destination !== currentFlight.origin) {
            issues.push(createFlightSequenceIssue(previousFlight, currentFlight, 'Next departure airport ' + currentFlight.origin + ' does not match previous arrival airport ' + previousFlight.destination + '.'));
        }

        if (currentFlight.departureTime <= previousFlight.arrivalTime) {
            issues.push(createFlightSequenceIssue(previousFlight, currentFlight, 'Next flight does not depart after the previous flight arrives.'));
        }
    }

    return {
        checkedCount: checkedFlights.length,
        issueCount: issues.length,
        issues: issues,
    };
}

function createFlightSequenceIssue(previousFlight, currentFlight, message) {
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

function isCancelledFlight(flight) {
    const status = String(flight && flight.status ? flight.status : '').trim().toLowerCase();
    return status === 'cancelled' || status === 'canceled';
}

function clearFlightSequenceHighlights() {
    $('.aes-aircraft-flights-sequence-issue-row').removeClass('aes-aircraft-flights-sequence-issue-row');
}

function highlightSequenceIssueFlights(issues) {
    clearFlightSequenceHighlights();
    issues.forEach(function(issue) {
        (issue.flights || []).forEach(function(flight) {
            if (flight.row && flight.row.length) {
                flight.row.addClass('aes-aircraft-flights-sequence-issue-row');
            }
        });
    });
}

function getFlightSequenceLabel(flight) {
    if (!flight) {
        return 'Unknown flight';
    }
    return (flight.flightNumber || ('Flight ' + flight.id)) + ' (' + (flight.departureText || '?') + ' ' + (flight.origin || '?') + ' -> ' + (flight.arrivalText || '?') + ' ' + (flight.destination || '?') + ')';
}

function getData() {
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
        hubEffective: hubStats.hub,
        hubOverride: '',
        profit: 0,
        profitFlights: 0
    }
}

function getFlightsStats(flights) {
    let finished, total;
    finished = total = 0;
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
function getFlights(serverDate) {
    const table = document.querySelector("#aircraft-flight-instances-table")
    if (!table) {
        throw new Error("Aircraft flights table #aircraft-flight-instances-table was not found")
    }
    const rows = table.querySelectorAll("tbody tr")
    const flights = []

    for (const row of rows) {
        const flight = {
            arrivalTime: null,
            arrivalText: '',
            departureTime: null,
            departureText: '',
            destination: null,
            flightNumber: '',
            origin: null,
            status: null,
            id: null,
            row: null
        }
        const flightNumber = row.querySelector("td:nth-child(2)")?.innerText.trim()
        if (flightNumber === "XFER" || flightNumber === undefined) {
            continue
        }
        const url = row.querySelector(`[href*="action/info/flight"]`)?.href
        if (!url) {
            continue
        }

        flight.status = row.querySelector(".flightStatusPanel")?.innerText.trim()
        flight.id = parseInt(url.match(/id=(\d+)/)[1], 10)
        flight.flightNumber = flightNumber
        flight.origin = row.querySelector("td:nth-child(3) span:last-child")?.innerText.trim() || ''
        flight.destination = row.querySelector("td:nth-child(5) span:last-child")?.innerText.trim() || ''
        flight.departureText = getFlightTimeText(row, 4)
        flight.arrivalText = getFlightTimeText(row, 6)
        flight.departureTime = parseAircraftFlightUtcTime(flight.departureText, serverDate)
        flight.arrivalTime = parseAircraftFlightUtcTime(flight.arrivalText, serverDate)
        flight.row = $(row)
        flights.push(flight)
    }

    return flights
}

function getFlightTimeText(row, cellIndex) {
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

function parseAircraftFlightUtcTime(value, serverDate) {
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

function getHubStats(flights) {
    let counts = {};
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

function syncFleetHubData(callback) {
    resolveAircraftFleetMatches(function(matches) {
        let changed = false;

        matches.forEach(function(match) {
            if ((match.aircraft.hubDetected || '') != (aircraftFlightData.hubDetected || '')) {
                match.aircraft.hubDetected = aircraftFlightData.hubDetected || '';
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

function updateHubOverride(override) {
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

function showAircraftFlightsNotification(message, type) {
    if (aircraftFlightNotifications) {
        aircraftFlightNotifications.add(message, { type: type });
    }
}

function refreshHubSummary() {
    $('#aes-aircraft-hub-detected').text(aircraftFlightData.hubDetected || '--');
    $('#aes-aircraft-hub-override').text(aircraftFlightData.hubOverride || '--');
    $('#aes-aircraft-hub-effective').text(aircraftFlightData.hubEffective || aircraftFlightData.hubDetected || '--');
}

function resolveAircraftFleetMatches(callback) {
    chrome.storage.local.get([aircraftFleetKey], function(result) {
        let matches = [];
        let fleetData = result[aircraftFleetKey];
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

function formatMoney(value) {
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
