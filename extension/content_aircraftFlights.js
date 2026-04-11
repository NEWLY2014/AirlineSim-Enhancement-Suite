"use strict";
//MAIN
//Global vars
var aircraftFlightData;
var aircraftFlightAirline;
var aircraftFleetKey;
$(function() {
    aircraftFlightData = getData();
    let currentAirline = AES.getCurrentAirline();
    aircraftFlightAirline = currentAirline && currentAirline.id ? currentAirline : AES.getAirline();
    aircraftFleetKey = aircraftFlightData.server + aircraftFlightAirline.id + 'aircraftFleet';

    //Async start
    getStorageData();
});

function getStorageData() {
    let keys = [];
    for (let i = 0; i < aircraftFlightData.flights.length; i++) {
        let key = aircraftFlightData.server + 'flightInfo' + aircraftFlightData.flights[i].id;
        keys.push(key);
    }
    chrome.storage.local.get(keys, function(result) {
        for (let flightInfo in result) {
            for (let i = 0; i < aircraftFlightData.flights.length; i++) {
                if (aircraftFlightData.flights[i].id == result[flightInfo].flightId) {
                    aircraftFlightData.flights[i].data = result[flightInfo];
                }
            }
        }

        //Async
        getTotalProfit();
    });
}

function getTotalProfit() {
    let profit = 0;
    let profitFlights = 0;
    aircraftFlightData.flights.forEach(function(value) {
        if (value.status == 'finished' || value.status == 'inflight') {
            if (value.data) {
                profit += value.data.money.CM5.Total;
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
    let btn = $('<button type="button" class="btn btn-default"></button>').text('Extract all flight profit/loss');
    let btn1 = $('<button type="button" class="btn btn-default"></button>').text('Extract finished flight profit/loss');
    let saveOverrideBtn = $('<button type="button" class="btn btn-default"></button>').text('Save HUB override');
    let resetOverrideBtn = $('<button type="button" class="btn btn-default"></button>').text('Reset to default');
    let hubInput = $('<input type="text" class="form-control aes-aircraft-flights-hub-input" maxlength="4">').val(aircraftFlightData.hubOverride || '');
    let span = $('<span class="aes-dashboard-filter-status"></span>');
    let toolbar = $('<div class="aes-aircraft-flights-toolbar aes-aircraft-flights-summary"></div>').append(
        $('<div class="aes-aircraft-flights-toolbar-row"></div>').append(
            $('<div class="aes-aircraft-flights-toolbar-group"></div>').append(
                $('<label class="control-label aes-aircraft-flights-toolbar-label"></label>').text('HUB'),
                hubInput,
                $('<div class="btn-group aes-dashboard-control-actions"></div>').append(saveOverrideBtn, resetOverrideBtn)
            ),
            $('<div class="aes-aircraft-flights-toolbar-group aes-aircraft-flights-toolbar-group-actions"></div>').append(
                $('<div class="btn-group aes-dashboard-control-actions"></div>').append(btn1, btn)
            )
        ),
        $('<div class="aes-aircraft-flights-toolbar-status"></div>').append(span)
    );
    //btn click
    btn.click(function() {
        btn.hide();
        btn1.hide();
        span.removeClass('good bad warning').addClass('warning').text('Please reload page after all flight info pages open');
        extractAllFlightProfit('all');
    });
    btn1.click(function() {
        btn.hide();
        btn1.hide();
        span.removeClass('good bad warning').addClass('warning').text('Please reload page after all flight info pages open');
        extractAllFlightProfit('finished');
    });
    saveOverrideBtn.click(function() {
        let override = hubInput.val().trim().toUpperCase();
        if (!override) {
            span.removeClass('good warning').addClass('bad').text('Enter a HUB code first');
            return;
        }
        updateHubOverride(override, span);
    });
    resetOverrideBtn.click(function() {
        hubInput.val('');
        resetHubOverride(span);
    });
    let content = $('<div class="aes-aircraft-flights-block"></div>').append(
        $('<div class="aes-aircraft-flights-title"></div>').text('AES Aircraft Flights'),
        toolbar,
        tableWell
    );
    $('.as-page-aircraft .tab-pane.active:first > form:first').before(content);
}

async function extractAllFlightProfit(type) {
    for (const value of aircraftFlightData.flights) {
        if (type === 'finished') {
            if (value.status !== 'finished' && value.status !== 'inflight') {
                continue;
            }
        }
        const url = 'https://' + aircraftFlightData.server + '.airlinesim.aero/action/info/flight?id=' + value.id;
        window.open(url, '_blank');
        await AES.sleep(30 + Math.floor(Math.random() * 41));
    }
}

function displayFlightProfit() {
    //Table
    let table = $('#aircraft-flight-instances-table');
    //Head
    let th = ['<th>Profit/Loss</th>', '<th>Extract date</th>'];
    $('th:eq(9)', table).after(th);
    //body
    aircraftFlightData.flights.forEach(function(value) {
        let td = [];

        if (value.data) {
            td.push(formatMoney(value.data.money.CM5.Total));
            td.push($('<td></td>').text(AES.formatDateString(value.data.date) + ' ' + value.data.time));
        } else {
            td.push('<td class="text-center">--</td>');
            td.push('<td class="text-center">--</td>');
        }

        $('td:eq(11)', value.row).after(td);
    });
    $("tfoot td", table).attr("colspan", "15")
}

function buildTable() {
    let row = [];
    row.push($('<tr></tr>').append(
        '<th>Total aircraft profit/loss</th>',
        $('<td colspan="3"></td>').append(formatMoney(aircraftFlightData.profit).contents())
    ));
    row.push($('<tr></tr>').append(
        '<th>Aircraft Id</th>', '<td>' + aircraftFlightData.aircraftId + '</td>',
        '<th>Registration</th>', '<td>' + aircraftFlightData.registration + '</td>'
    ));
    row.push($('<tr></tr>').append(
        '<th>Detected HUB</th>', $('<td id="aes-aircraft-hub-detected"></td>').text(aircraftFlightData.hubDetected || '--'),
        '<th>Current HUB</th>', $('<td id="aes-aircraft-hub-effective"></td>').text(aircraftFlightData.hubEffective || aircraftFlightData.hubDetected || '--')
    ));
    row.push($('<tr></tr>').append(
        '<th>Override HUB</th>', $('<td id="aes-aircraft-hub-override"></td>').text(aircraftFlightData.hubOverride || '--'),
        '<th>Total flights</th>', '<td>' + aircraftFlightData.totalFlights + '</td>'
    ));
    row.push($('<tr></tr>').append(
        '<th>Finished flights</th>', '<td>' + aircraftFlightData.finishedFlights + '</td>',
        '<th>Finished flights with profit/loss extract</th>', '<td>' + aircraftFlightData.profitFlights + '</td>'
    ));
    row.push($('<tr></tr>').append(
        '<th>Data save time</th>',
        '<td colspan="3">' + AES.formatDateString(aircraftFlightData.date) + ' ' + aircraftFlightData.time + '</td>'
    ));

    let tbody = $('<tbody></tbody>').append(row);
    return $('<table class="table table-bordered table-striped table-hover"></table>').append(tbody);
}

function getData() {
    //Aircraft ID
    let aircraftId = getAircraftId();
    let aircraftInfo = getAircraftInfo();
    let date = AES.getServerDate()
    let server = AES.getServerName();
    let flights = getFlights();
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
        hubOverride: ''
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
 * @returns {array} flights
 */
function getFlights() {
    const table = document.querySelector("#aircraft-flight-instances-table")
    const rows = table.querySelectorAll("tbody tr")
    const flights = []

    for (const row of rows) {
        const flight = {
            destination: null,
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
            throw new Error("getFlights(): no valid value for `url`")
            continue
        }

        flight.status = row.querySelector(".flightStatusPanel")?.innerText.trim()
        flight.id = parseInt(url.match(/id=(\d+)/)[1], 10)
        flight.origin = row.querySelector("td:nth-child(3) span:last-child")?.innerText.trim() || ''
        flight.destination = row.querySelector("td:nth-child(5) span:last-child")?.innerText.trim() || ''
        flight.row = $(row)
        flights.push(flight)
    }

    return flights
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
    resolveAircraftFleetData(function(key, fleetData, matchedAircraft) {
        let changed = false;

        if (matchedAircraft) {
            if ((matchedAircraft.hubDetected || '') != (aircraftFlightData.hubDetected || '')) {
                matchedAircraft.hubDetected = aircraftFlightData.hubDetected || '';
                changed = true;
            }
            if (!matchedAircraft.hubOverride && (matchedAircraft.hubEffective || '') != (matchedAircraft.hubDetected || '')) {
                matchedAircraft.hubEffective = matchedAircraft.hubDetected || '';
                changed = true;
            }
        }

        if (matchedAircraft) {
            aircraftFlightData.hubOverride = matchedAircraft.hubOverride || '';
            aircraftFlightData.hubEffective = matchedAircraft.hubOverride || matchedAircraft.hubEffective || matchedAircraft.hubDetected || aircraftFlightData.hubDetected || '';
        } else {
            aircraftFlightData.hubOverride = '';
            aircraftFlightData.hubEffective = aircraftFlightData.hubDetected || '';
        }

        let finish = function() {
            persistAircraftFlightSummary(callback);
        };

        if (changed) {
            chrome.storage.local.set({ [key]: fleetData }, function() {
                finish();
            });
            return;
        }

        finish();
    });
}

function updateHubOverride(override, statusEl) {
    resolveAircraftFleetData(function(key, fleetData, matchedAircraft) {
        if (!fleetData || !Array.isArray(fleetData.fleet) || !matchedAircraft) {
            statusEl.removeClass('good warning').addClass('bad').text('Extract fleet data first');
            return;
        }

        matchedAircraft.hubOverride = override;
        matchedAircraft.hubEffective = override;

        chrome.storage.local.set({ [key]: fleetData }, function() {
            aircraftFlightData.hubOverride = override;
            aircraftFlightData.hubEffective = override;
            persistAircraftFlightSummary(function() {
                refreshHubSummary();
                statusEl.removeClass('bad warning').addClass('good').text('HUB override saved');
            });
        });
    });
}

function resetHubOverride(statusEl) {
    resolveAircraftFleetData(function(key, fleetData, matchedAircraft) {
        if (!fleetData || !Array.isArray(fleetData.fleet) || !matchedAircraft) {
            statusEl.removeClass('good warning').addClass('bad').text('Extract fleet data first');
            return;
        }

        matchedAircraft.hubOverride = '';
        matchedAircraft.hubEffective = matchedAircraft.hubDetected || aircraftFlightData.hubDetected || '';

        chrome.storage.local.set({ [key]: fleetData }, function() {
            aircraftFlightData.hubOverride = '';
            aircraftFlightData.hubEffective = aircraftFlightData.hubDetected || '';
            persistAircraftFlightSummary(function() {
                refreshHubSummary();
                statusEl.removeClass('bad warning').addClass('good').text('Reset to detected HUB');
            });
        });
    });
}

function refreshHubSummary() {
    $('#aes-aircraft-hub-detected').text(aircraftFlightData.hubDetected || '--');
    $('#aes-aircraft-hub-override').text(aircraftFlightData.hubOverride || '--');
    $('#aes-aircraft-hub-effective').text(aircraftFlightData.hubEffective || aircraftFlightData.hubDetected || '--');
}

function resolveAircraftFleetData(callback) {
    chrome.storage.local.get(null, function(result) {
        let matchedKey = null;
        let fleetData = null;
        let matchedAircraft = null;

        Object.keys(result).some(function(key) {
            if (key.indexOf(aircraftFlightData.server) !== 0 || !key.endsWith('aircraftFleet')) {
                return false;
            }

            let value = result[key];
            if (!value || !Array.isArray(value.fleet)) {
                return false;
            }

            let aircraft = value.fleet.find(function(item) {
                return item.aircraftId == aircraftFlightData.aircraftId;
            });

            if (!aircraft) {
                return false;
            }

            matchedKey = key;
            fleetData = value;
            matchedAircraft = aircraft;
            return true;
        });

        if (!matchedKey && result[aircraftFleetKey] && Array.isArray(result[aircraftFleetKey].fleet)) {
            matchedKey = aircraftFleetKey;
            fleetData = result[aircraftFleetKey];
            matchedAircraft = fleetData.fleet.find(function(item) {
                return item.aircraftId == aircraftFlightData.aircraftId;
            }) || null;
        }

        if (matchedKey) {
            aircraftFleetKey = matchedKey;
        }

        callback(matchedKey || aircraftFleetKey, fleetData, matchedAircraft);
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
