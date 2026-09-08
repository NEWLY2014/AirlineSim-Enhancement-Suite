/** Shared contracts. Declarations only: these never create browser globals. */
declare namespace AESModel {
    type NotificationType = 'success' | 'warning' | 'error';
    interface NotificationOptions {
        type?: NotificationType;
        duration?: number;
        fadeDuration?: number;
    }
    type Cabin = 'Y' | 'C' | 'F' | 'Cargo';
    interface PricingStep {
        min: number;
        max: number;
        name: string;
        step: number;
    }
    interface PricingRecommendation {
        maxPrice: number;
        minPrice: number;
        steps: PricingStep[];
    }
    interface InventoryPricingSettings {
        autoAnalysisSave: number;
        autoPriceUpdate: number;
        autoClose: number;
        showReferenceRecommendation: number;
        recommendation: Record<Cabin, PricingRecommendation>;
        historyTable: {
            showNow: number;
            showOnlyPricing: number;
            numberOfDates: string;
        };
    }
    interface Airline {
        id: string | null;
        name: string | null;
        code: string;
        displayName: string;
    }
}

declare namespace AESModel {
    interface FrontendSettings extends Record<string, unknown> {
        theme?: string;
        fixedEnterpriseId?: string | number;
        server?: { time?: string; [key: string]: unknown };
    }
    interface StoredAirline extends Record<string, unknown> {
        id?: string | null;
        code?: string;
    }
    type WaitResult = Element | ArrayLike<Element> | boolean | string | number | null | undefined;
    type WaitTarget = string | string[] | (() => WaitResult);
    type Initializer = () => void | Promise<void>;
    interface WaitOptions {
        scriptName?: string;
        debounce?: number;
        timeout?: number;
        root?: Node;
        onTimeout?: Initializer;
        errorMessage?: string;
    }
    interface LogEntry {
        time: string;
        level: string;
        source: string;
        message: string;
        url: string;
        version: string;
        details?: object;
    }
}

/** Optional page data is always checked at the runtime boundary. */
declare var frontendSettings: unknown;

declare namespace AESModel {
    interface MenuItem {
        label?: string;
        isHeader?: boolean;
        isDivider?: boolean;
        href?: string;
        newWindow?: boolean;
        icon?: { className: string };
        data?: { toggle: string; target: string };
    }
}
