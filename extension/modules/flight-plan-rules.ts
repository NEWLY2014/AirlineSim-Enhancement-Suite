/** Compare one parsed visual-plan snapshot with the template. */
namespace AESFlightPlanRules {
    export function daysMatch(entry: AESModel.FlightPlanEntry, actual: AESModel.VisualFlightPlanEntry | undefined, offset: number) {
        const days=entry.selectedDays.map(day=>(day+offset)%7);
        return !!actual && actual.selectedDays.length===days.length && days.every(day=>actual.selectedDays.includes(day));
    }
    export function matches(entry: AESModel.FlightPlanEntry, actual: AESModel.VisualFlightPlanEntry | undefined, offset: number) {
        if (!actual || !daysMatch(entry,actual,offset)) return false;
        return entry.selectedDays.every(day=>{
            const expected=entry.daySettings?.[day], observed=actual.daySettings[(day+offset)%7];
            if (!expected || !observed) return false;
            const segments=expected.segments || {0:{arrival:expected.arrival}};
            return Object.entries(segments).every(([index,segment])=>{
                if(entry.arrivalModes?.[index]?.[day]===false)return true;
                const arrival=segment.arrival, found=observed.segments[Number(index)]?.arrival;
                return !!arrival?.hours && !!arrival.minutes && !!found?.hours && !!found.minutes &&
                    Number(arrival.hours)===Number(found.hours) && Number(arrival.minutes)===Number(found.minutes) &&
                    Number(arrival.dayOffset || 0)===Number(found.dayOffset || 0);
            });
        });
    }
}
