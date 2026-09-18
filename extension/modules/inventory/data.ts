/** Inventory storage validation; no DOM access or page state. */
namespace AESInventoryData {
const cabins: AESModel.Cabin[] = ['Y','C','F','Cargo'];
export function emptyInventoryItem(): AESModel.InventoryItem {
    return { totalCap: 0, totalBkd: 0, valid: 0, analysisPrice: 0, analysisPricePoint: 0,
        useCurrentPrice: 0, canRecommend: 0, analysisSourcePrice: 0, currentPrice: 0,
        currentPricePoint: 0, recommendation: 0, newPrice: 0, newPricePoint: 0, newPriceChange: 0,
        recType: 'neutral', referenceRecommendation: 0, referenceRecType: 'neutral',
        referenceNewPrice: 0, referenceNewPricePoint: 0, index: 0 };
}

export function readInventoryItem(value: unknown): AESModel.InventoryItem {
    const item = AESInventoryData.emptyInventoryItem();
    if (!AES.isRecord(value)) return item;
    const keys: Array<Exclude<keyof AESModel.InventoryItem, 'recommendationIsCustom' | 'referenceRecommendationIsCustom' | 'valid' | 'recommendation' | 'referenceRecommendation' | 'recType' | 'referenceRecType'>> =
        ['totalCap','totalBkd','analysisPrice','analysisPricePoint','useCurrentPrice','canRecommend','analysisSourcePrice','currentPrice','currentPricePoint','newPrice','newPricePoint','newPriceChange','referenceNewPrice','referenceNewPricePoint','index'];
    for (const key of keys) if (typeof value[key] === 'number' && Number.isFinite(value[key])) item[key] = value[key];
    for (const key of ['recommendationIsCustom', 'referenceRecommendationIsCustom'] as const) if (typeof value[key] === 'boolean') item[key] = value[key];
    item.valid = !!value.valid && item.totalCap > 0 && ['totalCap','totalBkd','analysisPrice','analysisPricePoint'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]));
    for (const key of ['recommendation', 'referenceRecommendation'] as const) if (typeof value[key] === 'string') item[key] = value[key];
    for (const key of ['recType', 'referenceRecType'] as const) if (typeof value[key] === 'string') item[key] = value[key];
    return item;
}

export function readInventorySnapshot(value: unknown): AESModel.InventorySnapshot | null {
    if (!AES.isRecord(value) || !AES.isRecord(value.data)) return null;
    const result: AESModel.InventorySnapshot = {
        ...value, data: { Y: AESInventoryData.readInventoryItem(value.data.Y), C: AESInventoryData.readInventoryItem(value.data.C), F: AESInventoryData.readInventoryItem(value.data.F), Cargo: AESInventoryData.readInventoryItem(value.data.Cargo) },
        updateTime: typeof value.updateTime === 'string' ? value.updateTime : undefined,
        date: typeof value.date === 'number' ? value.date : undefined,
        pricingUpdated: typeof value.pricingUpdated === 'number' ? value.pricingUpdated : 0
    };
    delete result.pricingUpdatePending;
    const pending = value.pricingUpdatePending;
    if (AES.isRecord(pending) && AES.isRecord(pending.targetPrices)) {
        const targetPrices: Partial<Record<AESModel.Cabin, number>> = {};
        for (const cmp of cabins) {
            const target = pending.targetPrices[cmp];
            if (typeof target === 'number' && Number.isFinite(target) && target > 0) targetPrices[cmp] = target;
        }
        if (Object.keys(targetPrices).length === Object.keys(pending.targetPrices).length && Object.keys(targetPrices).length) {
            result.pricingUpdatePending = {targetPrices, updateTime: typeof pending.updateTime === 'string' ? pending.updateTime : ''};
        }
    }
    return result;
}

export function readInventorySettings(value: unknown): AESModel.InventorySettings {
    if (!AES.isRecord(value) || !AES.isRecord(value.invPricing) || !AES.isRecord(value.invPricing.recommendation)) throw new Error(AESI18n.t("Inventory pricing settings are missing. Save pricing settings before using inventory analysis."));
    const source = value.invPricing;
    if (source.mode !== undefined && source.mode !== 'steps' && source.mode !== 'curve') throw new Error(AESI18n.t('Invalid pricing curve.'));
    const mode=AESPricingCurve.mode(source);
    const readConfig = (cmp: AESModel.Cabin): AESModel.PricingRecommendation => {
        const rec = AES.isRecord(source.recommendation) ? source.recommendation[cmp] : undefined;
        if (!AES.isRecord(rec) || typeof rec.minPrice !== 'number' || !Number.isFinite(rec.minPrice) || typeof rec.maxPrice !== 'number' || !Number.isFinite(rec.maxPrice) || rec.minPrice < 0 || rec.maxPrice < rec.minPrice || !Array.isArray(rec.steps)) throw new Error(AESI18n.t("Invalid inventory price bounds for {0}", {0: cmp}));
        const steps: AESModel.PricingStep[] = [];
        for (const step of rec.steps) {
            if (!AES.isRecord(step) || typeof step.min !== 'number' || !Number.isFinite(step.min) || typeof step.max !== 'number' || !Number.isFinite(step.max) || step.min > step.max || typeof step.step !== 'number' || !Number.isFinite(step.step) || typeof step.name !== 'string') throw new Error(AESI18n.t("Invalid inventory pricing step for {0}", {0: cmp}));
            steps.push({min: step.min, max: step.max, name: step.name, step: step.step});
        }
        if (rec.mode !== undefined && rec.mode !== 'steps' && rec.mode !== 'curve') throw new Error(AESI18n.t('Invalid pricing curve.'));
        const points=rec.points === undefined ? (mode==='curve' ? AESPricingCurve.defaults() : undefined) : AESPricingCurve.points(rec.points);
        if ((rec.points !== undefined && !points) || (mode === 'curve' && !points)) throw new Error(AESI18n.t('Invalid pricing curve.'));
        return {minPrice: rec.minPrice, maxPrice: rec.maxPrice, steps, points:points || undefined};
    };
    const history = AES.isRecord(source.historyTable) ? source.historyTable : {};
    const enabled = (value: unknown) => value === true || value === 1 || value === '1';
    return { invPricing: { mode, autoAnalysisSave: enabled(source.autoAnalysisSave) ? 1 : 0, autoPriceUpdate: enabled(source.autoPriceUpdate) ? 1 : 0,
        autoClose: enabled(source.autoClose) ? 1 : 0, showReferenceRecommendation: enabled(source.showReferenceRecommendation) ? 1 : 0,
        historyTable: {showNow: history.showNow ? 1 : 0, showOnlyPricing: history.showOnlyPricing ? 1 : 0, numberOfDates: typeof history.numberOfDates === 'string' ? history.numberOfDates : '5'},
        recommendation: {Y: readConfig('Y'), C: readConfig('C'), F: readConfig('F'), Cargo: readConfig('Cargo')} } };
}

export function getHistoryPreferences(settings: Record<string, unknown>): Record<string, unknown> {
    if (!AES.isRecord(settings.invPricing)) settings.invPricing = {};
    const inv = settings.invPricing;
    if (!AES.isRecord(inv)) throw new Error(AESI18n.t("Invalid inventory settings"));
    if (!AES.isRecord(inv.historyTable)) inv.historyTable = {};
    return AES.isRecord(inv.historyTable) ? inv.historyTable : {};
}
}
