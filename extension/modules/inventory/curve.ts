/** Control-point pricing. All intermediate values remain unrounded. */
namespace AESPricingCurve {
    export function points(value: unknown): AESModel.PricingPoint[] | null {
        if (!Array.isArray(value) || value.length < 2) return null;
        const result: AESModel.PricingPoint[] = [];
        for (const point of value) {
            if (!point || typeof point !== 'object' || typeof point.load !== 'number' || !Number.isFinite(point.load) || point.load < 0 || point.load > 100 || typeof point.change !== 'number' || !Number.isFinite(point.change)) return null;
            result.push({load:point.load, change:point.change});
        }
        result.sort((a,b)=>a.load-b.load);
        if (result[0].load !== 0 || result[result.length-1].load !== 100 || result.some((point,i)=>i>0 && point.load===result[i-1].load)) return null;
        return result;
    }
    export function interpolate(points: AESModel.PricingPoint[], load: number): number {
        const x=Math.min(100,Math.max(0,load));
        for (let i=1;i<points.length;i++) {
            const a=points[i-1],b=points[i];
            if (x<=b.load) return a.change+(b.change-a.change)*(x-a.load)/(b.load-a.load);
        }
        return points[points.length-1].change;
    }
    // Correct only floating-point noise at integer/half-integer rounding boundaries.
    function snap(value:number):number {
        const nearest=Math.round(value);
        return Math.abs(value-nearest)<=Number.EPSILON*Math.max(1,Math.abs(value))*4 ? nearest : value;
    }
    export function price(base:number, standard:number, change:number, min:number, max:number):number | null {
        if (![base,standard,change,min,max].every(Number.isFinite) || base<=0 || standard<=0 || min<0 || min>=max) return null;
        const lower=Math.max(1,Math.ceil(snap(standard*min/100)));
        const upper=Math.floor(snap(standard*max/100));
        if (lower>upper || !Number.isSafeInteger(lower) || !Number.isSafeInteger(upper)) return null;
        const raw=base+standard*change/100;
        if (!Number.isFinite(raw)) return null;
        return Math.min(upper,Math.max(lower,Math.floor(snap(raw+0.5))));
    }
}
