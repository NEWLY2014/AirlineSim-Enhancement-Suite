declare namespace AESModel {
    type DashboardScalar = string | number | boolean | null | undefined;
    type DashboardRow = Record<string, DashboardScalar>;
    type DashboardFilter = Record<string, string>;
    interface DashboardColumn {
        category?: string; title: string; data: string; className?: string; cellClass?: string;
        filterValue?: string; number?: number | boolean; visible?: number | boolean;
        sortable?: number | boolean; id?: number | boolean; aggregate?: string | false;
        format?: string; filterable?: boolean; text?: string; name?: string;
        render?: (row: DashboardRow) => DashboardScalar | JQuery;
    }
    interface DashboardRouteColumn { class: string; name: string; number?: number; show?: number; value?: string }
    interface DashboardCompetitorColumn { headGroup: string; text: string; field: string; visible?: number; number?: number }
    interface DashboardSettings extends Record<string, unknown> {
        general: Record<string, unknown> & { defaultDashboard?: string; dashboardFilterScopeKey?: string };
        schedule: Record<string, unknown> & { autoExtract?: number };
        routeManagement: {tableColumns: DashboardRouteColumn[]; filter: DashboardFilter[]};
        competitorMonitoring: {tableColumns: DashboardCompetitorColumn[]; filter: DashboardFilter[]; migrationFlags?: Record<string, number>};
        aircraftProfitability: {filter: DashboardFilter[]; hideColumn: string[]};
    }
    interface DashboardTableOptions {
        columns: DashboardColumn[]; data: DashboardRow[]; selectable?: boolean; footer?: boolean;
        tableId?: string; columnPrefix?: string; rowId?: (row: DashboardRow) => DashboardScalar;
    }
    interface DashboardGeneratedTableOptions {
        column: DashboardColumn[]; data: DashboardRow[]; columnPrefix: string;
        tableSettings: number; options: string[]; filter: DashboardFilter[]; hideColumn: string[];
        tableSettingStorage: 'aircraftProfitability'; onColumnChange?: () => void;
        rowId?: (row: DashboardRow) => DashboardScalar;
    }
    interface DashboardFilterPanelOptions {
        columns: DashboardColumn[]; filters: DashboardFilter[]; valueField: string; labelField: string;
        onApply: (filters: DashboardFilter[], status: JQuery) => void;
        operations?: string[] | ((column: DashboardColumn | undefined) => string[]);
    }
    interface DashboardSchedule { type?: string; server?: string; airline: {id: string}; date: Record<string, { schedule: Array<ScheduleRoute & {od: string}> }> }
    interface DashboardAnalysis { origin: string; destination: string; date: Record<string, {data: Partial<Record<Cabin, {valid?: number | boolean; totalCap: number; totalBkd: number; index: number}>>; pricingUpdated?: number}> }
    interface DashboardAnalysisDates { analysis: string; pricing: string; analysisOneBefore: string; pricingOneBefore: string }
    interface DashboardCompetitor extends Record<string, unknown> {key: string; type: string; server: string; ownerId?: string; id: string; tracking: number | boolean; tab0: Record<string, DashboardRow>; tab2: Record<string, DashboardRow>}
}
