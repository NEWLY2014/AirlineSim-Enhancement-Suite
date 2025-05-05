"use strict";
//MAIN
var settings, compData, server, airline, date;
$(function() {
    server = AES.getServerName();
    airline = AES.getAirline();
    date = AES.getServerDate();
    chrome.storage.local.get(['settings'], function(result) {
        settings = result.settings;
        let label = $('<h3></h3>').text('AES Schedule');
        let btn = $('<button class="btn btn-default" id="aes-extractSchedule-btn"></button>').text('Extract Schedule');
        let panel = $('<div id="aes-panel-schedule" class="as-panel"></div>').append(btn);
        //Main DIv
        $('.flight-schedule').prepend(label, panel);

        //Extract Schedule
        btn.click(function() {
            extractSchedule();
        });

        //Automation
        if (settings.schedule.autoExtract) {
            settings.schedule.autoExtract = 0;
            chrome.storage.local.set({ settings: settings }, function() {
                btn.click();
            });
        } else {
            //Check if automation via competitor monitoring
            let key = server + airline.id + 'competitorMonitoring';
            chrome.storage.local.get([key], function(compMonitoringData) {
                compData = compMonitoringData[key];
                if (compData) {
                    if (compData.autoExtract) {
                        btn.click();
                    }
                }
            });

        }
    });
});
//FUNCTIONS
function extractSchedule() {
    //Update text
    //'<span class="warning"> Extracting...</span>';
    let span = $('<span class="warning"></span>').text('Extracting...');
    $('#aes-panel-schedule').append(span);
    $('#aes-extractSchedule-btn').remove();

    //Get table
    let tbody = $('.flight-schedule table tbody');
    //Extract schedule
    //Each tbody
    let schedule = [];
    for (let i = 0; i < tbody.length; i++) {
        //Each row
        let destinationCount = 0;
        let rows = $('tr', tbody[i]);
        let route = {};
        for (let j = 0; j < rows.length; j++) {
            if (rows[j].className == 'important origin') {
                //origin
                route.origin = $('a', rows[j]).text();
            } else if (rows[j].className == 'destination') {
                //Check if first destination
                if (destinationCount) {
                    //Push array and reset values
                    schedule.push(route);
                    route = {
                        origin: route.origin
                    };
                }
                //destination
                route.destination = $('a', rows[j]).text();
                destinationCount++;
            } else if (rows[j].className != 'head') {
                //line row
                route = getLineDetails(rows[j], route);
            }
        }
        //Push array and reset values
        schedule.push(route);
        route = {};
    }
    //Handle extracted schedule
    //Get hubs
    let hub = {};
    schedule.forEach(function(route) {
        if (!hub[route.origin]) {
            hub[route.origin] = 0;
        }
        hub[route.origin]++;
    });
    //Generate OD
    schedule.forEach(function(route) {
        if (hub[route.origin] > hub[route.destination]) {
            route.od = route.origin + route.destination;
            route.direction = 'Outbound';
        } else if (hub[route.origin] < hub[route.destination]) {
            route.od = route.destination + route.origin;
            route.direction = 'Inbound';
        } else if (hub[route.origin] == hub[route.destination]) {
            if (route.origin < route.destination) {
                route.od = route.origin + route.destination;
                route.direction = 'Outbound';
            } else {
                route.od = route.destination + route.origin;
                route.direction = 'Inbound';
            }
        }
    });
    //Save to storage
    let newScheduleData = {
        date: date.date,
        updateTime: date.time,
        schedule: schedule
    };
    //New key and data storage
    let key = server + airline.id + 'schedule';
    let defaultScheduleData = {
        type: 'schedule',
        server: server,
        airline: airline,
        date: {}
    };
    chrome.storage.local.get({
        [key]: defaultScheduleData }, function(result) {
        let scheduleData = result[key];
        scheduleData.date[date.date] = newScheduleData;
        //Push to storage
        chrome.storage.local.set({
            [key]: scheduleData }, function() {
            span.removeClass().addClass('good').text('Schedule extracted!');
            if (compData) {
                if (compData.autoExtract) {
                    compData.autoExtract = 0;
                    chrome.storage.local.set({
                        [compData.key]: compData }, function() {
                        window.open('./' + airline.id + '?tab=0', '_self');
                    });
                }
            }
        });
    });



    //Schedule Functions
    function getLineDetails(row, route) {
        //Flight number
        let flightNumber = $(".code:eq(0)", row).text().split(' ');
        flightNumber = parseInt(flightNumber[1], 10);
        //Check if exist alraedy
        if (!route.flightNumber) {
            route.flightNumber = {};
        }
        if (!route.flightNumber[flightNumber]) {
            route.flightNumber[flightNumber] = {
                paxFreq: 0,
                cargoFreq: 0,
                remark: $(".remarks", row).text(),
                valid: $(".valid", row).text()
            }
        }
        //Get Frequency
        let days = $(".days", row).text().split('');
        for (let i = 0; i < days.length; i++) {
            if (days[i] >= '0' && days[i] <= '9') {
                //Check if cargo or pax
                if (route.flightNumber[flightNumber].remark) {
                    route.flightNumber[flightNumber].cargoFreq++;
                } else {
                    route.flightNumber[flightNumber].paxFreq++;
                }
            }
        }
        return route;
    }
}
