declare namespace AESModel {
    interface CompetitorRecord extends Record<string, unknown> {
        key: string;
        server: string;
        ownerId: string | null;
        ownerAirline: Airline;
        id: string | null;
        type: 'competitorMonitoring';
        tab0: Record<string, unknown>;
        tab2: Record<string, unknown>;
        tracking: number | boolean;
        autoExtract: number | boolean;
    }
    interface CompetitorOverview extends Airline {
        rating: string;
        pax: number;
        cargo: number;
        stations: number;
        fleet: number;
        employees: number;
        tab0data: 1;
        date?: string;
        updateTime?: string;
    }
    interface CompetitorFacts {
        week: number;
        airportsServed: number;
        operatedFlights: number;
        seatsOffered: number;
        sko: number;
        cargoOffered: number;
        fko: number;
        tab2data: 2;
        date?: string;
        updateTime?: string;
    }
    interface ScheduleFrequency {
        paxFreq: number;
        cargoFreq: number;
        remark: string;
        valid: string;
    }
    interface ScheduleRoute {
        origin: string;
        destination: string;
        flightNumber: Record<string, ScheduleFrequency>;
        od?: string;
        direction?: 'Outbound' | 'Inbound';
    }
    interface ScheduleSnapshot {
        date: string;
        updateTime: string;
        schedule: ScheduleRoute[];
    }
    interface ScheduleRecord extends Record<string, unknown> {
        type: 'schedule';
        server: string;
        airline: Airline;
        date: Record<string, unknown>;
    }
}
