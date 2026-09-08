declare namespace AESModel {
    interface InventoryFlight { fltNr: string; date: string; cmp: Cabin; cap: number; bkd: number; price: number; status: string }
    interface InventoryPrice { currentPrice: number; defaultPrice: number; currentPricePoint: number; newPriceInput: HTMLInputElement }
    type InventoryPrices = Record<Cabin, InventoryPrice>;
    interface InventoryItem {
        totalCap: number; totalBkd: number; valid: boolean | number;
        analysisPrice: number; analysisPricePoint: number; useCurrentPrice: number;
        canRecommend: number; analysisSourcePrice: number; currentPrice: number; currentPricePoint: number;
        recommendation: string | 0; newPrice: number; newPricePoint: number; newPriceChange: number;
        recType: string; referenceRecommendation: string | 0; referenceRecType: string;
        referenceNewPrice: number; referenceNewPricePoint: number; index: number;
    }
    interface InventorySnapshot extends Record<string, unknown> {
        data: Record<Cabin, InventoryItem>;
        updateTime?: string;
        date?: number;
        pricingUpdated?: number;
        pricingUpdatePending?: { targetPrices: Partial<Record<Cabin, number>>; updateTime: string };
    }
    interface InventoryAnalysis extends InventorySnapshot {
        getLoad(cmp: Cabin): number;
        note(cmp: Cabin): string;
        displayLoad(cmp: Cabin): string;
        displayRec(cmp: Cabin): string | JQuery;
        displayReferenceRec(cmp: Cabin): string | JQuery;
        displayPrice(cmp: Cabin, type: 'current' | 'new' | 'analysis'): string;
        displayIndex(cmp: Cabin): string | JQuery;
        displayTotalLoad(type: 'all' | 'pax'): string;
        displayTotalIndex(type: 'all' | 'pax'): string | JQuery;
        hasValue(value: keyof InventoryItem): number;
    }
    interface InventoryRecord extends Record<string, unknown> { key: string; date: Record<string, unknown> }
    interface InventorySettings { invPricing: InventoryPricingSettings }
}
