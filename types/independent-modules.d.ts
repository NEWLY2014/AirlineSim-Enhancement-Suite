/** Contracts for standalone extension pages and individual content modules. */
declare namespace AESModel {
    type StorageSnapshot = Record<string, unknown>;
    type BackupType = 'all' | 'settings' | 'schedule' | 'pricing' | 'competitorMonitoring' | 'flightInfo' | 'aircraftData' | 'logs';
    interface ExportBackup {
        metadata: {
            version?: string;
            created: string;
            type: BackupType | 'log';
            itemCount: number;
            date?: unknown;
        };
        data: StorageSnapshot;
    }
    // Import metadata remains open to older backups; the payload envelope is checked.
    interface BackupEnvelope {
        metadata: Record<string, unknown>;
        data: StorageSnapshot;
    }
    interface LogFileSummary {
        key: string;
        date: unknown;
        entryCount: number;
        size: number;
    }
    interface ReleaseNotes {
        title: string;
        releaseDate: string;
        summary: string;
        sections: Array<{ title: string; items: string[] }>;
    }
    interface FooterVersionAnchor {
        parent: Node;
        beforeNode: Node;
        wrapperTag: 'div' | 'span';
    }
    type FinancialColumn = Cabin | 'PAX' | 'Total';
    type FlightFinancials = Record<string, Partial<Record<FinancialColumn, number>>>;
    interface FlightInfoRecord {
        server: string;
        flightId: number;
        type: 'flightInfo';
        money: FlightFinancials;
        date: string;
        time: string;
    }
}

declare namespace AESModel {
    interface PersonnelSettings extends Record<string, unknown> {
        value: number;
        type: 'absolute' | 'perc';
        auto: number | boolean;
        alreadyUpdated: unknown[];
    }
    interface SalaryUpdateOptions {
        actionButton?: JQuery;
    }
    interface SalaryColumnIndexes {
        salaryInputIndex?: number;
        countryAverageIndex?: number;
    }
}
