declare namespace AESModel {
    interface AircraftIdentity {
        aircraftId?: number | string | null;
        registration?: string | null;
    }
    interface FleetAircraft extends AircraftIdentity, Record<string, unknown> {
        fleet?: string | null;
        hubDetected?: string | null;
        hubEffective?: string | null;
        hubOverride?: string | null;
        hubDetectionSource?: string | null;
    }
    interface FleetRecord extends Record<string, unknown> {
        fleet: FleetAircraft[];
    }
    interface AircraftProfit {
        date: string;
        time: string;
        finishedFlights: number;
        totalFlights: number;
        profit: number;
        profitFlights: number;
        hubDetected?: string | null;
        hubEffective?: string | null;
        hubOverride?: string | null;
    }
    interface FleetPageAircraft extends FleetAircraft {
        registration: string;
        equipment: string;
        age: number;
        maintenance: number;
        nickname: string;
        note: string;
        fleet: string;
        delivered: boolean;
        owned: boolean;
        seatY: number;
        seatC: number;
        seatF: number;
        seatConfig: string;
        totalSeats: number;
        pureCargo: boolean;
        pilotAssigned: boolean;
        pilotAssignedLabel: string;
        scheduleState: string;
        scheduleStateLabel: string;
        date: string;
        time: string;
        row: HTMLTableRowElement;
        profit?: AircraftProfit;
    }
    interface AircraftFlight {
        arrivalTime: number | null;
        arrivalText: string;
        departureTime: number | null;
        departureText: string;
        destination: string;
        origin: string;
        flightNumber: string;
        status: string;
        id: number;
        row: JQuery<HTMLTableRowElement>;
        data?: { money: { CM5: { Total: number } }; date: string; time: string };
    }
    interface AircraftFlightData extends AircraftProfit {
        server: string;
        aircraftId: number;
        registration: string;
        equipment: string;
        type: 'aircraftFlights';
        flights: AircraftFlight[];
        hubCounts: Record<string, number>;
        hubDetected: string;
        hubEffective: string;
        hubOverride: string;
        hubDetectionSource: string;
    }
    interface FlightSequenceIssue { flights: AircraftFlight[]; message: string }
    interface FlightSequenceValidation { checkedCount: number; issueCount: number; issues: FlightSequenceIssue[] }
    interface FlightExtractionProgress { failed: number; opened: number; total: number; lastError: string }
    interface FlightExtractionState { failed: number; message: string; opened: number; running: boolean; tone: string; total: number }
    interface TabOpenResult { ok: boolean; error?: string; method?: string }
    interface AircraftFleetMatch { key: string; fleetData: FleetRecord; aircraft: FleetAircraft }
}
