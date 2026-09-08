declare namespace AESModel {
    interface FlightPlanTime {
        dayOffset?: number;
        hours?: string;
        minutes?: string;
        value?: string;
    }
    interface FlightPlanDay {
        departure?: FlightPlanTime;
        arrival?: FlightPlanTime;
        segments?: Record<string, { arrival?: FlightPlanTime }>;
    }
    interface FlightPlanEntry {
        flightCode?: string;
        flightNumberLabel?: string;
        flightNumberToken?: string;
        flightNumberValue?: string;
        selectedDays: number[];
        daySettings?: Record<string, FlightPlanDay>;
    }
    interface VisualFlightPlanEntry extends FlightPlanEntry {
        daySettings: Record<number, {
            departure: Required<FlightPlanTime>;
            segments: Record<number, { arrival: Required<FlightPlanTime> }>;
        }>;
        _segments?: Array<{arrival: Required<FlightPlanTime>; dayIndex: number; departure: Required<FlightPlanTime>; segmentIndex: number}>;
    }
    interface FlightPlanTemplate extends Record<string, unknown> {
        type: 'aircraftFlightPlanTemplate';
        schemaVersion: number;
        flights: FlightPlanEntry[];
        sourceAircraftId: string;
        sourceModel: string;
        sourceRegistration: string;
    }
    type FlightPlanJobStatus = 'selecting' | 'waitForSelection' | 'applying' | 'waitForApply' | 'done' | 'error';
    interface FlightPlanJob extends Record<string, unknown> {
        type: 'aircraftFlightPlanSchedulingJob';
        status: FlightPlanJobStatus;
        currentIndex: number;
        entries: FlightPlanEntry[];
        offsetDays: number;
        targetAircraftId: string | number;
        targetRegistration?: string;
        errorMessage?: string;
    }
    interface FlightPlanState {
        airline: Airline;
        aircraft: { id: string; registration: string; model: string };
        extracting: boolean;
        hubObserver: MutationObserver | null;
        hubSaveTimer: number | undefined;
        job: FlightPlanJob | null;
        jobInvalid: boolean;
        notifications: Notifications | null;
        offsetDays: number;
        processingJob: boolean;
        runtimeMessage: string;
        runtimeType: NotificationType;
        server: string;
        template: FlightPlanTemplate | null;
        templateStale: boolean;
    }
    interface PlannerArrival {
        arrivalDayOffset: number;
        arrivalHours: string;
        arrivalMinutes: string;
    }
    type PlannerTargetDays = Record<number, { sourceDay: number; targetDay: number }>;
    type ExistingFlightSelection = { value: string; text: string };
}
