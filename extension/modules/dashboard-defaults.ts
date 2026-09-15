/** Dashboard column definitions, independent of page state and storage. */
namespace AESDashboardDefaults {
export function getDefaultRouteManagementSettings() {
    let columns = [
        {
            name: 'Origin',
            class: 'aes-origin',
            number: 0,
            show: 1,
            value: 'origin'
    },
        {
            name: 'Destination',
            class: 'aes-destination',
            number: 0,
            show: 1,
            value: 'destination'
    },
        {
            name: 'Hub',
            class: 'aes-hub',
            number: 0,
            show: 1,
            value: 'hub'
    },
        {
            name: 'OD',
            class: 'aes-od',
            number: 0,
            show: 1,
            value: 'odName'
    },
        {
            name: 'Direction',
            class: 'aes-direction',
            number: 0,
            show: 1,
            value: 'direction'
    },
        {
            name: '# of flight numbers',
            class: 'aes-fltNr',
            number: 1,
            show: 1,
            value: 'fltNr'
    },
        {
            name: 'PAX frequency',
            class: 'aes-paxFreq',
            number: 1,
            show: 1,
            value: 'paxFreq'
    },
        {
            name: 'Cargo frequency',
            class: 'aes-cargoFreq',
            number: 1,
            show: 1,
            value: 'cargoFreq'
    },
        {
            name: 'Total Frequency',
            class: 'aes-totalFreq',
            number: 1,
            show: 1,
            value: 'totalFreq'
    },
        {
            name: 'Analysis date',
            class: 'aes-analysisDate',
            number: 0,
            show: 1
    },
        {
            name: 'Previous Analysis date',
            class: 'aes-analysisPreDate',
            number: 0,
            show: 1
    },
        {
            name: 'Pricing date',
            class: 'aes-pricingDate',
            number: 0,
            show: 1
    },
        {
            name: 'PAX load',
            class: 'aes-paxLoad',
            number: 1,
            show: 1
    },
        {
            name: 'PAX load Δ',
            class: 'aes-paxLoadDelta',
            number: 1,
            show: 1
    },
        {
            name: 'Cargo load',
            class: 'aes-cargoLoad',
            number: 1,
            show: 1
    },
        {
            name: 'Cargo load Δ',
            class: 'aes-cargoLoadDelta',
            number: 1,
            show: 1
    },
        {
            name: 'Total load',
            class: 'aes-load',
            number: 1,
            show: 1
    },
        {
            name: 'Total load Δ',
            class: 'aes-loadDelta',
            number: 1,
            show: 1
    },
        {
            name: 'PAX index',
            class: 'aes-paxIndex',
            number: 1,
            show: 1
    },
        {
            name: 'PAX index Δ',
            class: 'aes-paxIndexDelta',
            number: 1,
            show: 1
    },
        {
            name: 'Cargo index',
            class: 'aes-cargoIndex',
            number: 1,
            show: 1
    },
        {
            name: 'Cargo index Δ',
            class: 'aes-cargoIndexDelta',
            number: 1,
            show: 1
    },
        {
            name: 'Index',
            class: 'aes-index',
            number: 1,
            show: 1
    },
        {
            name: 'Index Δ',
            class: 'aes-indexDelta',
            number: 1,
            show: 1
    },
        {
            name: 'Route PAX index',
            class: 'aes-routeIndexPax',
            number: 1,
            show: 1
    },
        {
            name: 'Route Cargo index',
            class: 'aes-routeIndexCargo',
            number: 1,
            show: 1
    },
        {
            name: 'Route index',
            class: 'aes-routeIndex',
            number: 1,
            show: 1
    }
  ];
    return {
        tableColumns: columns,
        filter: []
    };
}

export function getDefaultCompetitorMonitoringColumns() {
    let columns = [
        {
            field: 'airlineId',
            text: 'ID',
            headGroup: 'Airline',
            visible: 1,
            number: 1
    },
        {
            field: 'airlineCode',
            text: 'Code',
            headGroup: 'Airline',
            visible: 1,
            number: 0
    },
        {
            field: 'airlineName',
            text: 'Name',
            headGroup: 'Airline',
            visible: 1,
            number: 0
    },
        {
            field: 'overviewDate',
            text: 'Overview date',
            headGroup: 'Overview',
            visible: 0,
            number: 0
    },
        {
            field: 'overviewPreDate',
            text: 'Overview previous date',
            headGroup: 'Overview',
            visible: 0,
            number: 0
    },
        {
            field: 'overviewRating',
            text: 'Rating',
            headGroup: 'Overview',
            visible: 1,
            number: 0
    },
        {
            field: 'overviewRatingDelta',
            text: 'Rating Δ',
            headGroup: 'Overview',
            visible: 0,
            number: 0
    },
        {
            field: 'overviewTotalPax',
            text: 'Total pax',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewTotalPaxDelta',
            text: 'Total pax Δ',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewTotalCargo',
            text: 'Total cargo',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewTotalCargoDelta',
            text: 'Total cargo Δ',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewStations',
            text: 'Stations',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewStationsDelta',
            text: 'Stations Δ',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewFleet',
            text: 'Fleet',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewFleetDelta',
            text: 'Fleet Δ',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewStaff',
            text: 'Staff',
            headGroup: 'Overview',
            visible: 0,
            number: 1
    },
        {
            field: 'overviewStaffDelta',
            text: 'Staff Δ',
            headGroup: 'Overview',
            visible: 0,
            number: 1
    },
        {
            field: 'fafWeek',
            text: 'Week',
            headGroup: 'Figures',
            visible: 0,
            number: 0
    },
        {
            field: 'fafWeekPre',
            text: 'Previous week',
            headGroup: 'Figures',
            visible: 0,
            number: 0
    },
        {
            field: 'fafAirportsServed',
            text: 'Airports served',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'fafAirportsServedDelta',
            text: 'Airports served Δ',
            headGroup: 'Figures',
            visible: 0,
            number: 1
    },
        {
            field: 'fafOperatedFlights',
            text: 'Operated flights',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'fafOperatedFlightsDelta',
            text: 'Operated flights Δ',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'fafSeatsOffered',
            text: 'Seats offered',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'fafSeatsOfferedDelta',
            text: 'Seats offered Δ',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'fafsko',
            text: 'Seat kilometer offered (SKO)',
            headGroup: 'Figures',
            visible: 0,
            number: 1
    },
        {
            field: 'fafskoDelta',
            text: 'Seat kilometer offered (SKO) Δ',
            headGroup: 'Figures',
            visible: 0,
            number: 1
    },
        {
            field: 'fafCargoOffered',
            text: 'Units offered',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'fafCargoOfferedDelta',
            text: 'Units offered Δ',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'faffko',
            text: 'Freight kilometer offered (FKO)',
            headGroup: 'Figures',
            visible: 0,
            number: 1
    },
        {
            field: 'faffkoDelta',
            text: 'FKO Δ',
            headGroup: 'Figures',
            visible: 0,
            number: 1
    },
        {
            field: 'scheduleDate',
            text: 'Schedule Date',
            headGroup: 'Schedule',
            visible: 0,
            number: 0
    },
        {
            field: 'scheduleDatePre',
            text: 'Previous Schedule Date',
            headGroup: 'Schedule',
            visible: 0,
            number: 0
    },
        {
            field: 'scheduleHubs',
            text: 'Hubs (routes)',
            headGroup: 'Schedule',
            visible: 1,
            number: 0
    },
        {
            field: 'scheduleFltNr',
            text: '# of flight numbers',
            headGroup: 'Schedule',
            visible: 0,
            number: 1
    },
        {
            field: 'scheduleFltNrDelta',
            text: '# of flight numbers Δ',
            headGroup: 'Schedule',
            visible: 0,
            number: 1
    },
        {
            field: 'schedulePAXFreq',
            text: 'PAX frequency',
            headGroup: 'Schedule',
            visible: 0,
            number: 1
    },
        {
            field: 'schedulePAXFreqDelta',
            text: 'PAX frequency Δ',
            headGroup: 'Schedule',
            visible: 0,
            number: 1
    },
        {
            field: 'scheduleCargoFreq',
            text: 'Cargo frequency',
            headGroup: 'Schedule',
            visible: 0,
            number: 1
    },
        {
            field: 'scheduleCargoFreqDelta',
            text: 'Cargo frequency Δ',
            headGroup: 'Schedule',
            visible: 0,
            number: 1
    },
        {
            field: 'scheduleTotalFreq',
            text: 'Total frequency',
            headGroup: 'Schedule',
            visible: 1,
            number: 1
    },
        {
            field: 'scheduleTotalFreqDelta',
            text: 'Total frequency Δ',
            headGroup: 'Schedule',
            visible: 1,
            number: 1
    }
  ];
    return columns.filter(function(column) {
        return column.headGroup != 'Actions';
    });
}
}
