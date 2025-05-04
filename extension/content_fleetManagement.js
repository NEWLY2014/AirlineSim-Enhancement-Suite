"use strict";
//MAIN
//Global vars
var aircraftData = [];
var server, aircraftFleetKey, aircraftFleetStorageData, airline, date;
$(function() {
    airline = AES.getAirline();
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
    let fleet = $('.as-page-fleet-management > .row > .col-md-9 > h2:eq(0)').text();
    $('tbody tr', table).each(function() {
        let data = {
            registration: $('td:eq(1) > span:eq(0)', this).text(),
            nickname: fltmng_getNickname($('td:eq(1) > div:eq(0)', this).text()),
            equipment: $('td:eq(2) > a:eq(0)', this).text(),
            age: fltmng_getAge($('td:eq(4) > span:eq(0)', this).text()),
            maintenance: fltmng_getMaintanance($('td:eq(4) > div > span:eq(1)', this).text()),
            aircraftId: fltmng_getAircraftId($('td:eq(6) > div > div:eq(1) > a:eq(0)', this).attr('href')),
            note: fltmng_getNickname($('td:eq(7) > span > span', this).text()),
            fleet: fleet,
            date: date.date,
            time: date.time
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

function fltmng_getAge(value) {
    value = value.replace(/[a-z]/gi, '');
    value = value.replace(',', '.');
    value = parseFloat(value);
    return value;
}

function fltmng_getMaintanance(value) {
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

function fltmng_getStorageData() {
    let keys = [];
    aircraftData.forEach(function(value) {
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
                        profit: result[aircraftFlightData].profit,
                        profitFlights: result[aircraftFlightData].profitFlights,
                        time: result[aircraftFlightData].time,
                        totalFlights: result[aircraftFlightData].totalFlights,
                    };
                }
            }
        }
        //Async
        fltmng_getAircraftStorageFleetData();
    });
}

function fltmng_getAircraftStorageFleetData() {
    aircraftFleetKey = server + airline.id + 'aircraftFleet';
    chrome.storage.local.get(aircraftFleetKey, function(result) {
        fltmng_updateAircraftFleetStorageData(result[aircraftFleetKey]);
        fltmng_saveData();
    });
}

function fltmng_updateAircraftFleetStorageData(data) {
    aircraftFleetStorageData = {
        server: server,
        type: 'aircraftFleet',
        airline: airline,
        fleet: aircraftData
    }
    if (data) {
        let newfleet = [];
        //Push all new aircrafts
        aircraftData.forEach(function(newvalue) {
            newfleet.push({
                age: newvalue.age,
                aircraftId: newvalue.aircraftId,
                date: newvalue.date,
                equipment: newvalue.equipment,
                fleet: newvalue.fleet,
                maintanence: newvalue.maintanence,
                nickname: newvalue.nickname,
                note: newvalue.note,
                registration: newvalue.registration,
                time: newvalue.time
            });
        });

        //push all old aircrafts that dont have new data
        data.fleet.forEach(function(value) {
            let found = 0;
            newfleet.forEach(function(newValue) {
                if (value.aircraftId == newValue.aircraftId) {
                    found = 1;
                }
            });
            if (!found) {
                newfleet.push(value);
            }
        });
        //Attach new fleet
        aircraftFleetStorageData.fleet = newfleet;
    }
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

    let panel = $('<div class="as-panel"></div>').append(p);
    //Header
    let h = $('<h3></h3>').text('AES Fleet Management');
    let div = $('<div></div>').append(h, panel);
    $('.as-page-fleet-management > h1:eq(0)').after(div);
}

function fltmng_displayAircraftProfit() {
    let table = $('.as-page-fleet-management > .row > .col-md-9 > .as-panel:eq(0) table');
    //Head
    let th = ['<th rowspan="2" class="aes-text-right">Profit/Loss</th>', '<th rowspan="2">Extract date</th>'];
    $('thead tr:eq(0)', table).append(th);
    //Body
    $('tbody tr', table).each(function() {
        let id = fltmng_getAircraftId($('td:eq(6) > div > div:eq(1) > a:eq(0)', this).attr('href'));
        let profit, date, time;
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
        let td = [];
        if (date) {
            td.push($('<td></td>').html(AES.formatCurrency(profit, 'right')));
            td.push($('<td></td>').html(AES.formatDateString(date) + '<br>' + time));
        } else {
            td.push('<td></td>', '<td></td>');
        }
        $(this).append(td);
    });
}

function fltmng_displaySavedAircrafts() {
    return 'Currently ' + aircraftFleetStorageData.fleet.length + ' aircrafts stored in memory.';
}

function fltmng_displayNewUpdates() {
    let span = $('<span class="good"></span>').text('Updated aircraft data for ' + aircraftData.length + ' from ' + aircraftData[0].fleet);
    return span;
}
