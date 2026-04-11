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
        fltmng_enrichUndeliveredAircraftIds().then(function() {
            //Async start
            fltmng_getStorageData();
        });
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
            contractLink: fltmng_getContractLink(this),
            contractState: fltmng_getContractState(this),
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
        let match = String(value).match(/(?:\/app\/fleets\/|\.\.\/)*aircraft\/(\d+)(?:\/|[?#]|$)/);
        if (match) {
            return parseInt(match[1], 10);
        }

        value = value.split('/');
        let parsed = parseInt(value[value.length - 2], 10);
        if (!isNaN(parsed)) {
            return parsed;
        }
    }
}

function fltmng_getAircraftIdFromRow(row) {
    let aircraftId = fltmng_getAircraftId(fltmng_getAircraftPageLink(row));
    if (aircraftId) {
        return aircraftId;
    }

    let hrefs = $(row).find('a[href*="aircraft/"]').map(function() {
        return $(this).attr('href');
    }).get();
    for (let i = 0; i < hrefs.length; i++) {
        aircraftId = fltmng_getAircraftId(hrefs[i]);
        if (aircraftId) {
            return aircraftId;
        }
    }

    let htmlMatch = ($(row).html() || '').match(/(?:\/app\/fleets\/|\.\.\/)*aircraft\/(\d+)(?:\/|[?#]|$)/);
    if (htmlMatch) {
        return parseInt(htmlMatch[1], 10);
    }

    return null;
}

function fltmng_getAircraftPageLink(row) {
    return $('a[href*="aircraft/"][title="Flights"]', row).attr('href') ||
        $('a[href*="aircraft/"][title="Flight Planning"]', row).attr('href') ||
        $('a[href*="aircraft/"][href*="/1"]', row).attr('href') ||
        $('a[href*="aircraft/"][href*="/0"]', row).attr('href') ||
        $('a[href*="aircraft/"]', row).first().attr('href');
}

function fltmng_isDelivered(row) {
    return $('td:eq(4)', row).text().indexOf('Delivery:') == -1;
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

function fltmng_getContractState(row) {
    let state = '';
    $('.btn-group-contract .dropdown-menu li div', row).each(function() {
        let text = $(this).text().replace(/\s+/g, ' ').trim();
        if (text.indexOf('Contract status:') == 0) {
            state = $('span:last', this).text().trim().toLowerCase();
            return false;
        }
    });
    return state;
}

function fltmng_getContractLink(row) {
    return $('.btn-group-contract .dropdown-menu a[href*="/app/enterprise/contracts/"]', row).attr('href') || '';
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
            return 'Active';
        case 'pending':
            return 'Locked';
        case 'conflict':
            return 'Conflict';
        case 'undelivered':
            return 'Undelivered';
        default:
            return 'Empty';
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

function fltmng_enrichUndeliveredAircraftIds() {
    let pendingAircraft = aircraftData.filter(function(value) {
        return !value.aircraftId && !value.owned && !value.delivered && !!value.contractLink;
    });

    if (!pendingAircraft.length) {
        return Promise.resolve();
    }

    return Promise.all(pendingAircraft.map(function(aircraft) {
        return fltmng_fetchContractAircraftData(aircraft.contractLink).then(function(contractData) {
            if (!contractData) {
                return;
            }

            if (contractData.contractState) {
                aircraft.contractState = contractData.contractState;
            }
            if (contractData.aircraftId) {
                aircraft.aircraftId = contractData.aircraftId;
            }
        }).catch(function() {
            // Ignore contract fetch failures and keep local row data.
        });
    })).then(function() {});
}

function fltmng_fetchContractAircraftData(contractLink) {
    let url = new URL(contractLink, window.location.href).toString();
    return fetch(url, {
        credentials: 'include'
    }).then(function(response) {
        if (!response.ok) {
            throw new Error('Failed to load contract');
        }
        return response.text();
    }).then(function(html) {
        return fltmng_parseContractDocument(new DOMParser().parseFromString(html, 'text/html'));
    }).then(function(contractData) {
        if (contractData.aircraftId || contractData.contractState) {
            return contractData;
        }
        return fltmng_fetchContractAircraftDataViaIframe(url);
    }).catch(function() {
        return fltmng_fetchContractAircraftDataViaIframe(url);
    });
}

function fltmng_fetchContractAircraftDataViaIframe(url) {
    return new Promise(function(resolve, reject) {
        let iframe = document.createElement('iframe');
        let timeoutId = window.setTimeout(function() {
            cleanup();
            reject(new Error('Contract iframe load timeout'));
        }, 10000);

        function cleanup() {
            window.clearTimeout(timeoutId);
            iframe.remove();
        }

        iframe.style.display = 'none';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.onload = function() {
            try {
                let doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (!doc) {
                    throw new Error('Missing iframe document');
                }
                let contractData = fltmng_parseContractDocument(doc);
                cleanup();
                resolve(contractData);
            } catch (error) {
                cleanup();
                reject(error);
            }
        };
        iframe.onerror = function() {
            cleanup();
            reject(new Error('Contract iframe load failed'));
        };
        iframe.src = url;
        (document.body || document.documentElement).appendChild(iframe);
    });
}

function fltmng_parseContractDocument(doc) {
    let aircraftLink = null;
    let contractState = '';

    doc.querySelectorAll('table.contractInfo tr').forEach(function(row) {
        let label = (row.querySelector('th')?.textContent || '').trim().toLowerCase();
        if (label == 'contract state') {
            contractState = (row.querySelector('td.status')?.textContent || row.querySelector('td')?.textContent || '').trim().toLowerCase();
        }
    });

    doc.querySelectorAll('table tr').forEach(function(row) {
        let label = (row.querySelector('th')?.textContent || '').trim().toLowerCase();
        if (label == 'aircraft registration') {
            aircraftLink = row.querySelector('a[href*="/app/fleets/aircraft/"], a[href*="aircraft/"]');
        }
    });

    if (!aircraftLink) {
        aircraftLink = Array.from(doc.querySelectorAll('a[href*="/app/fleets/aircraft/"], a[href*="aircraft/"]')).find(function(link) {
            return (link.textContent || '').trim().toLowerCase() == 'view aircraft';
        }) || null;
    }

    return {
        aircraftId: aircraftLink ? fltmng_getAircraftId(aircraftLink.getAttribute('href')) : null,
        contractState: contractState
    };
}

function fltmng_getAircraftStorageFleetData() {
    aircraftFleetKey = server + airline.id + 'aircraftFleet';
    chrome.storage.local.get([aircraftFleetKey], function(result) {
        fltmng_updateAircraftFleetStorageData(result[aircraftFleetKey]);

        fltmng_saveData();
    });
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
        let storedAircraft = fltmng_getStoredAircraft(data, newvalue);
        newfleet.push(Object.assign({}, storedAircraft || {}, {
            age: newvalue.age,
            aircraftId: newvalue.aircraftId || (storedAircraft && storedAircraft.aircraftId ? storedAircraft.aircraftId : null),
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
                if (fltmng_isSameAircraft(value, newValue)) {
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
        if (fltmng_isSameAircraft(data.fleet[i], aircraftId)) {
            return data.fleet[i];
        }
    }

    return null;
}

function fltmng_isSameAircraft(storedAircraft, aircraft) {
    if (!storedAircraft || !aircraft) {
        return false;
    }

    let storedId = storedAircraft.aircraftId || null;
    let aircraftId = typeof aircraft === 'object' ? (aircraft.aircraftId || null) : aircraft;
    if (storedId && aircraftId && String(storedId) === String(aircraftId)) {
        return true;
    }

    let storedRegistration = (storedAircraft.registration || '').trim();
    let aircraftRegistration = typeof aircraft === 'object' ? ((aircraft.registration || '').trim()) : '';
    if (storedRegistration && aircraftRegistration && storedRegistration === aircraftRegistration) {
        return true;
    }

    return false;
}

function fltmng_saveData() {
    //Remove profit
    chrome.storage.local.set({
        [aircraftFleetKey]: aircraftFleetStorageData }, function() {
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
        text += ' Undelivered aircraft are stored by registration and will be merged once AirlineSim assigns an aircraft ID.';
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
        { value: 'active', label: 'Active' },
        { value: 'empty', label: 'Empty' },
        { value: 'pending', label: 'Locked' },
        { value: 'conflict', label: 'Conflict' },
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
