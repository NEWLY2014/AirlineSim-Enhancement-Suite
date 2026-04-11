"use strict";
//MAIN
//Global vars
var aircraftData = [];
var server, aircraftFleetKey, aircraftFleetStorageData, airline, date, currentFleet;
$(function() {
    let currentAirline = AES.getCurrentAirline();
    airline = currentAirline && currentAirline.id ? currentAirline : AES.getAirline();
    server = AES.getServerName();
    date = AES.getServerDate()

    if (fltmng_fleetManagementPageOpen()) {
        fltmng_getData();
        //Async start
        fltmng_getStorageData();
    }
});

function fltmng_fleetManagementPageOpen() {
    let a = $('.as-page-fleet-management');
    if (a.length) {
        return true;
    } else {
        return false;
    }
}

function fltmng_getData() {

    //Aircraft
    let table = $('.as-page-fleet-management > .row > .col-md-9 > .as-panel:eq(0) table');
    currentFleet = fltmng_normalizeFleetName($('.as-page-fleet-management > .row > .col-md-9 > h2:eq(0)').text());
    $('tbody tr', table).each(function() {
        let aircraftId = fltmng_getAircraftIdFromRow(this);

        let data = {
            registration: $('td:eq(1) > span:eq(0)', this).text(),
            nickname: fltmng_getNickname($('td:eq(1) > div:eq(0)', this).text()),
            equipment: $('td:eq(2) > a:eq(0)', this).text(),
            age: fltmng_getAge($('td:eq(4) > span:eq(0)', this).text()),
            maintenance: fltmng_getMaintenance($('td:eq(4) > div > span:eq(1)', this).text()),
            aircraftId: aircraftId,
            note: fltmng_getNickname($('td:eq(7) > span > span', this).text()),
            fleet: currentFleet,
            delivered: fltmng_isDelivered(this),
            owned: fltmng_isOwned(this),
            seatY: fltmng_getSeatValue($('td:eq(5) > span:eq(0)', this).text()),
            seatC: fltmng_getSeatValue($('td:eq(5) > span:eq(1)', this).text()),
            seatF: fltmng_getSeatValue($('td:eq(5) > span:eq(2)', this).text()),
            seatConfig: fltmng_getSeatConfig(this),
            totalSeats: fltmng_getTotalSeats(this),
            pureCargo: fltmng_isPureCargo(this),
            pilotAssigned: fltmng_hasPilots(this),
            pilotAssignedLabel: fltmng_hasPilots(this) ? 'Yes' : 'No',
            scheduleState: fltmng_getScheduleState(this),
            scheduleStateLabel: fltmng_getScheduleStateLabel(this),
            date: date.date,
            time: date.time,
            row: this
        }
        aircraftData.push(data);
    });
}

function fltmng_getNickname(value) {
    if (value == '...') {
        return ''
    } else {
        return value;
    }
}

function fltmng_normalizeFleetName(value) {
    return (value || '').trim();
}

function fltmng_getAge(value) {
    if (value.includes('UTC')) {
        return 0;
    } else {
        value = value.replace(/[a-z]/gi, '');
    value = value.replace(',', '.');
    value = parseFloat(value);
    return value;
    }
}

function fltmng_getMaintenance(value) {
    value = value.replace('%', '');
    value = value.replace(',', '.');
    value = parseFloat(value);
    return value;
}

function fltmng_getAircraftId(value) {
    if (value) {
        value = value.split('/');
        return parseInt(value[value.length - 2], 10);
    }
}

function fltmng_getAircraftIdFromRow(row) {
    return fltmng_getAircraftId(fltmng_getAircraftPageLink(row));
}

function fltmng_getAircraftPageLink(row) {
    return $('a[href*="/app/fleets/aircraft/"][title="Flights"]', row).attr('href') ||
        $('a[href*="/app/fleets/aircraft/"][title="Flight Planning"]', row).attr('href') ||
        $('a[href*="/app/fleets/aircraft/"][href*="/1"]', row).attr('href') ||
        $('a[href*="/app/fleets/aircraft/"][href*="/0"]', row).attr('href') ||
        $('a[href*="/app/fleets/aircraft/"]', row).first().attr('href');
}

function fltmng_isDelivered(row) {
    return $('td:eq(4) > span:eq(0)', row).text().indexOf('Delivery:') == -1;
}

function fltmng_getSeatValue(value) {
    let parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
}

function fltmng_getSeatConfig(row) {
    return [
        fltmng_getSeatValue($('td:eq(5) > span:eq(0)', row).text()),
        fltmng_getSeatValue($('td:eq(5) > span:eq(1)', row).text()),
        fltmng_getSeatValue($('td:eq(5) > span:eq(2)', row).text())
    ].join('/');
}

function fltmng_getTotalSeats(row) {
    return fltmng_getSeatValue($('td:eq(5) > span:eq(0)', row).text()) +
        fltmng_getSeatValue($('td:eq(5) > span:eq(1)', row).text()) +
        fltmng_getSeatValue($('td:eq(5) > span:eq(2)', row).text());
}

function fltmng_isPureCargo(row) {
    return fltmng_getTotalSeats(row) === 0;
}

function fltmng_hasPilots(row) {
    return $('td:eq(5) .subrow', row).text().trim().toLowerCase() == 'yes';
}

function fltmng_isOwned(row) {
    let owned = '';
    $('.btn-group-contract .dropdown-menu li div', row).each(function() {
        let text = $(this).text().replace(/\s+/g, ' ').trim();
        if (text.indexOf('Owned:') == 0) {
            owned = $('span:last', this).text().trim();
            return false;
        }
    });
    return owned == 'yes';
}

function fltmng_getScheduleState(row) {
    let flightPlanningBtn = $('a[title="Flight Planning"]', row);
    if (!flightPlanningBtn.length) {
        return fltmng_isDelivered(row) ? 'empty' : 'undelivered';
    }
    if (flightPlanningBtn.hasClass('btn-danger')) {
        return 'conflict';
    }
    if (flightPlanningBtn.hasClass('btn-warning')) {
        return 'pending';
    }
    if (flightPlanningBtn.hasClass('btn-success')) {
        return 'active';
    }
    return 'empty';
}

function fltmng_getScheduleStateLabel(row) {
    switch (fltmng_getScheduleState(row)) {
        case 'active':
            return 'Scheduled and operating';
        case 'pending':
            return 'Scheduled, not operating';
        case 'conflict':
            return 'Schedule conflict';
        case 'undelivered':
            return 'Undelivered';
        default:
            return 'No schedule';
    }
}

function fltmng_getStorageData() {
    let keys = [];
    aircraftData.forEach(function(value) {
        if (!value.aircraftId) {
            return;
        }
        let key = server + 'aircraftFlights' + value.aircraftId;
        keys.push(key);
    });
    chrome.storage.local.get(keys, function(result) {
        for (let aircraftFlightData in result) {
            for (let i = 0; i < aircraftData.length; i++) {
                if (aircraftData[i].aircraftId == result[aircraftFlightData].aircraftId) {
                    aircraftData[i].profit = {
                        date: result[aircraftFlightData].date,
                        finishedFlights: result[aircraftFlightData].finishedFlights,
                        hubDetected: result[aircraftFlightData].hubDetected,
                        hubEffective: result[aircraftFlightData].hubEffective,
                        hubOverride: result[aircraftFlightData].hubOverride,
                        profit: result[aircraftFlightData].profit,
                        profitFlights: result[aircraftFlightData].profitFlights,
                        time: result[aircraftFlightData].time,
                        totalFlights: result[aircraftFlightData].totalFlights,
                    };
                    aircraftData[i].hubOverride = result[aircraftFlightData].hubOverride || aircraftData[i].hubOverride || '';
                    aircraftData[i].hubEffective = result[aircraftFlightData].hubEffective || aircraftData[i].hubEffective || result[aircraftFlightData].hubDetected || '';
                    aircraftData[i].hubDetected = result[aircraftFlightData].hubDetected || aircraftData[i].hubDetected || '';
                }
            }
        }
        //Async
        fltmng_getAircraftStorageFleetData();
    });
}

function fltmng_getAircraftStorageFleetData() {
    let preferredKey = server + airline.id + 'aircraftFleet';
    chrome.storage.local.get(null, function(result) {
        aircraftFleetKey = fltmng_resolveAircraftFleetKey(result, preferredKey);
        fltmng_updateAircraftFleetStorageData(result[aircraftFleetKey]);

        AES.exposeDebug('fleetExtract', {
            aircraftFleetKey: aircraftFleetKey,
            aircraftCount: aircraftData.length,
            aircraftIds: aircraftData.map(function(value) { return value.aircraftId; }).filter(function(value) { return !!value; }).slice(0, 10),
            airline: airline,
            currentFleet: currentFleet,
            matchingKeys: fltmng_getMatchingAircraftFleetKeys(result),
            validAircraftCount: aircraftData.filter(function(value) { return !!value.aircraftId; }).length
        });

        fltmng_saveData();
    });
}

function fltmng_getMatchingAircraftFleetKeys(result) {
    return Object.keys(result || {}).map(function(key) {
        if (key.indexOf(server) !== 0 || !key.endsWith('aircraftFleet')) {
            return null;
        }
        let data = result[key];
        let score = fltmng_getAircraftFleetMatchScore(data);
        if (!score) {
            return null;
        }
        return {
            key: key,
            score: score,
            fleetSize: Array.isArray(data.fleet) ? data.fleet.length : 0
        };
    }).filter(Boolean).sort(function(a, b) {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        if (b.fleetSize !== a.fleetSize) {
            return b.fleetSize - a.fleetSize;
        }
        return a.key.localeCompare(b.key);
    });
}

function fltmng_resolveAircraftFleetKey(result, preferredKey) {
    let matchingKeys = fltmng_getMatchingAircraftFleetKeys(result);
    if (matchingKeys.length) {
        return matchingKeys[0].key;
    }
    return preferredKey;
}

function fltmng_getAircraftFleetMatchScore(data) {
    if (!data || data.type !== 'aircraftFleet' || !data.airline) {
        return 0;
    }

    if (airline.id && data.airline.id && String(data.airline.id) === String(airline.id)) {
        return 4;
    }
    if (airline.code && data.airline.code && data.airline.code === airline.code) {
        return 3;
    }
    if (airline.displayName && data.airline.displayName && data.airline.displayName === airline.displayName) {
        return 2;
    }
    if (airline.name && data.airline.name && data.airline.name === airline.name) {
        return 1;
    }

    return 0;
}

function fltmng_updateAircraftFleetStorageData(data) {
    aircraftFleetStorageData = {
        server: server,
        type: 'aircraftFleet',
        airline: airline,
        fleet: []
    }
    let newfleet = [];
    //Push all new aircrafts
    aircraftData.forEach(function(newvalue) {
        if (!newvalue.aircraftId) {
            return;
        }
        let storedAircraft = fltmng_getStoredAircraft(data, newvalue.aircraftId);
        newfleet.push(Object.assign({}, storedAircraft || {}, {
            age: newvalue.age,
            aircraftId: newvalue.aircraftId,
            date: newvalue.date,
            delivered: newvalue.delivered,
            equipment: newvalue.equipment,
            fleet: newvalue.fleet,
            hubDetected: newvalue.hubDetected || (storedAircraft && storedAircraft.hubDetected ? storedAircraft.hubDetected : ''),
            hubEffective: storedAircraft && storedAircraft.hubOverride ? storedAircraft.hubOverride : (newvalue.hubEffective || newvalue.hubDetected || (storedAircraft && storedAircraft.hubEffective ? storedAircraft.hubEffective : '')),
            hubOverride: newvalue.hubOverride || (storedAircraft && storedAircraft.hubOverride ? storedAircraft.hubOverride : ''),
            maintenance: newvalue.maintenance,
            nickname: newvalue.nickname,
            note: newvalue.note,
            owned: newvalue.owned,
            pilotAssigned: newvalue.pilotAssigned,
            pilotAssignedLabel: newvalue.pilotAssignedLabel,
            pureCargo: newvalue.pureCargo,
            registration: newvalue.registration,
            scheduleState: newvalue.scheduleState,
            scheduleStateLabel: newvalue.scheduleStateLabel,
            seatC: newvalue.seatC,
            seatConfig: newvalue.seatConfig,
            seatF: newvalue.seatF,
            seatY: newvalue.seatY,
            totalSeats: newvalue.totalSeats,
            time: newvalue.time
        }));
    });

    if (data && Array.isArray(data.fleet)) {
        //Push old aircrafts from other fleets. Aircraft missing from the
        //current fleet page has moved or been removed and should not linger.
        data.fleet.forEach(function(value) {
            let found = 0;
            newfleet.forEach(function(newValue) {
                if (value.aircraftId == newValue.aircraftId) {
                    found = 1;
                }
            });
            if (!found && fltmng_normalizeFleetName(value.fleet) != currentFleet) {
                newfleet.push(value);
            }
        });
    }
    //Attach new fleet
    aircraftFleetStorageData.fleet = newfleet;
}

function fltmng_getStoredAircraft(data, aircraftId) {
    if (!data || !Array.isArray(data.fleet)) {
        return null;
    }

    for (let i = 0; i < data.fleet.length; i++) {
        if (data.fleet[i].aircraftId == aircraftId) {
            return data.fleet[i];
        }
    }

    return null;
}

function fltmng_saveData() {
    //Remove profit
    chrome.storage.local.set({
        [aircraftFleetKey]: aircraftFleetStorageData }, function() {
        AES.exposeDebug('fleetExtract', Object.assign({}, {
            aircraftFleetKey: aircraftFleetKey,
            aircraftCount: aircraftData.length,
            aircraftIds: aircraftData.map(function(value) { return value.aircraftId; }).filter(function(value) { return !!value; }).slice(0, 10),
            airline: airline,
            currentFleet: currentFleet,
            savedFleetSize: Array.isArray(aircraftFleetStorageData.fleet) ? aircraftFleetStorageData.fleet.length : 0,
            validAircraftCount: aircraftData.filter(function(value) { return !!value.aircraftId; }).length
        }, {
            matchingKeys: [{
                key: aircraftFleetKey,
                score: fltmng_getAircraftFleetMatchScore(aircraftFleetStorageData),
                fleetSize: Array.isArray(aircraftFleetStorageData.fleet) ? aircraftFleetStorageData.fleet.length : 0
            }]
        }));
        fltmng_display();
    });
}

function fltmng_display() {
    fltmng_displayAircraftProfit();

    let p = [];
    p.push($('<p></p>').html(fltmng_displaySavedAircrafts()));
    p.push($('<p></p>').html(fltmng_displayNewUpdates()));
    p.push(fltmng_buildFilterPanel());

    let panel = $('<div class="as-panel"></div>').append(p);
    //Header
    let h = $('<h3></h3>').text('AES Fleet Management');
    let div = $('<div></div>').append(h, panel);
    $('.as-page-fleet-management > h1:eq(0)').after(div);
}

function fltmng_displayAircraftProfit() {
    let table = $('.as-page-fleet-management > .row > .col-md-9 > .as-panel:eq(0) table');
    table.addClass('aes-fleet-table');
    //Head
    $('thead tr:eq(0) th:eq(2)', table).html(
        $('thead tr:eq(0) th:eq(2)', table).html().replace('Aircraft model', 'Model')
    );
    $('thead tr:eq(0) th:eq(2)', table).after(
        $('<th rowspan="2" class="aes-fleet-extra-header">HUB</th>')
    );
    $('thead tr:eq(0)', table).append(
        $('<th rowspan="2" class="aes-fleet-extra-header">Profit/Loss</th>'),
        $('<th rowspan="2" class="aes-fleet-extra-header">Extract date</th>')
    );
    //Body
    $('tbody tr', table).each(function() {
        let id = fltmng_getAircraftIdFromRow(this);

        let profit, date, time;
        if (id) {
            aircraftData.forEach(function(value) {
                if (value.aircraftId == id) {
                    if (value.profit) {
                        if (value.profit.profitFlights) {
                            profit = value.profit.profit;
                            date = value.profit.date;
                            time = value.profit.time;
                        }
                    }
                }
            });
        }
        $('td:eq(2)', this).after(
            $('<td class="aes-fleet-extra-cell"></td>').text(fltmng_getAircraftHubDisplay(id))
        );
        if (date) {
            $(this).append(
                $('<td class="aes-fleet-extra-cell"></td>').html(AES.formatCurrency(profit, 'right')),
                $('<td class="aes-fleet-extra-cell"></td>').html(AES.formatDateString(date) + '<br>' + time)
            );
        } else {
            $(this).append(
                '<td class="aes-fleet-extra-cell text-center">--</td>',
                '<td class="aes-fleet-extra-cell text-center">--</td>'
            );
        }
    });
}

function fltmng_getResolvedHub(aircraft) {
    if (!aircraft) {
        return '';
    }

    if (aircraft.hubOverride) {
        return aircraft.hubOverride;
    }
    if (aircraft.hubEffective) {
        return aircraft.hubEffective;
    }
    if (aircraft.hubDetected) {
        return aircraft.hubDetected;
    }
    if (aircraft.profit) {
        return aircraft.profit.hubOverride || aircraft.profit.hubEffective || aircraft.profit.hubDetected || '';
    }

    return '';
}

function fltmng_getAircraftHubDisplay(aircraftId) {
    if (!aircraftId) {
        return '--';
    }

    if (aircraftFleetStorageData && Array.isArray(aircraftFleetStorageData.fleet)) {
        for (let i = 0; i < aircraftFleetStorageData.fleet.length; i++) {
            if (aircraftFleetStorageData.fleet[i].aircraftId == aircraftId) {
                let resolvedHub = fltmng_getResolvedHub(aircraftFleetStorageData.fleet[i]);
                if (resolvedHub) {
                    return resolvedHub;
                }
                break;
            }
        }
    }

    for (let i = 0; i < aircraftData.length; i++) {
        if (aircraftData[i].aircraftId == aircraftId) {
            return fltmng_getResolvedHub(aircraftData[i]) || '--';
        }
    }

    return '--';
}

function fltmng_displaySavedAircrafts() {
    let text = 'Currently ' + aircraftFleetStorageData.fleet.length + ' aircrafts stored in memory.';
    if (aircraftData.some(function(value) { return !value.aircraftId; })) {
        text += ' Undelivered aircraft stay filterable on this page and will be stored after AirlineSim assigns an aircraft ID.';
    }
    return text;
}

function fltmng_displayNewUpdates() {
    let span = $('<span class="good"></span>').text('Updated aircraft data for ' + aircraftData.length + ' from ' + currentFleet);
    return span;
}

function fltmng_buildFilterPanel() {
    let equipmentSelect = fltmng_buildFilterSelect('All models', fltmng_getUniqueAircraftValues('equipment'));
    let hubSelect = fltmng_buildFilterSelect('All HUBs', fltmng_getUniqueAircraftHubValues());
    let seatConfigSelect = fltmng_buildFilterSelect('All seat configs', fltmng_getUniqueAircraftValues('seatConfig'));
    let deliverySelect = fltmng_buildFilterSelect('All delivery states', [
        { value: 'delivered', label: 'Delivered' },
        { value: 'undelivered', label: 'Undelivered' }
    ]);
    let ownershipSelect = fltmng_buildFilterSelect('All ownership', [
        { value: 'owned', label: 'Owned' },
        { value: 'leased', label: 'Leased' }
    ]);
    let scheduleSelect = fltmng_buildFilterSelect('All schedules', [
        { value: 'active', label: 'Scheduled and operating' },
        { value: 'empty', label: 'No schedule' },
        { value: 'pending', label: 'Scheduled, not operating' },
        { value: 'conflict', label: 'Schedule conflict' },
        { value: 'undelivered', label: 'Undelivered' }
    ]);
    let resetBtn = $('<button type="button" class="btn btn-default"></button>').text('Reset filters');
    let status = $('<span class="text-muted"></span>');

    let form = $('<div class="row"></div>').append(
        fltmng_wrapFilterControl('Model', equipmentSelect),
        fltmng_wrapFilterControl('HUB', hubSelect),
        fltmng_wrapFilterControl('Seats (Y/C/F)', seatConfigSelect),
        fltmng_wrapFilterControl('Delivery', deliverySelect),
        fltmng_wrapFilterControl('Ownership', ownershipSelect),
        fltmng_wrapFilterControl('Schedule', scheduleSelect),
        $('<div class="col-md-12" style="margin-top: 8px;"></div>').append(resetBtn, ' ', status)
    );

    [equipmentSelect, hubSelect, seatConfigSelect, deliverySelect, ownershipSelect, scheduleSelect].forEach(function(select) {
        select.change(applyFilters);
    });
    resetBtn.click(function() {
        equipmentSelect.val('');
        hubSelect.val('');
        seatConfigSelect.val('');
        deliverySelect.val('');
        ownershipSelect.val('');
        scheduleSelect.val('');
        applyFilters();
    });

    applyFilters();
    return $('<div></div>').append(
        $('<p><strong>AES filters</strong></p>'),
        form
    );

    function applyFilters() {
        let visibleCount = 0;
        aircraftData.forEach(function(value) {
            let visible =
                (!equipmentSelect.val() || value.equipment == equipmentSelect.val()) &&
                (!hubSelect.val() || fltmng_getResolvedHub(value) == hubSelect.val()) &&
                (!seatConfigSelect.val() || value.seatConfig == seatConfigSelect.val()) &&
                (!deliverySelect.val() || (deliverySelect.val() == 'delivered' ? value.delivered : !value.delivered)) &&
                (!ownershipSelect.val() || (ownershipSelect.val() == 'owned' ? value.owned : !value.owned)) &&
                (!scheduleSelect.val() || value.scheduleState == scheduleSelect.val());

            $(value.row).toggle(visible);
            if (visible) {
                visibleCount++;
            }
        });
        status.text('Showing ' + visibleCount + ' of ' + aircraftData.length + ' aircraft');
    }
}

function fltmng_wrapFilterControl(label, control) {
    return $('<div class="col-md-2 col-sm-4" style="margin-top: 8px;"></div>').append(
        $('<label class="control-label"></label>').text(label),
        control
    );
}

function fltmng_buildFilterSelect(placeholder, values) {
    let select = $('<select class="form-control"></select>').append(
        $('<option value=""></option>').text(placeholder)
    );
    values.forEach(function(value) {
        if (typeof value == 'string') {
            select.append($('<option></option>').val(value).text(value));
        } else {
            select.append($('<option></option>').val(value.value).text(value.label));
        }
    });
    return select;
}

function fltmng_getUniqueAircraftValues(key) {
    let values = aircraftData.map(function(value) {
        return value[key];
    }).filter(function(value) {
        return value !== undefined && value !== null && value !== '';
    });

    values = values.filter(function(value, index) {
        return values.indexOf(value) == index;
    });
    values.sort();
    return values;
}

function fltmng_getUniqueAircraftHubValues() {
    let values = aircraftData.map(function(value) {
        return fltmng_getResolvedHub(value);
    }).filter(function(value) {
        return value !== undefined && value !== null && value !== '';
    });

    values = values.filter(function(value, index) {
        return values.indexOf(value) == index;
    });
    values.sort();
    return values;
}
