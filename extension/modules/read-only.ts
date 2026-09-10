/** Read-only collection from the current game page. Never execute fetched page scripts. */
class AESRead {
    static saves = new Map<string, () => boolean>();
    static context() {
        const href = location.href;
        const owner = String(AES.getCurrentAirline().id || '');
        return () => AES.isPageOwner() && location.href === href && !!owner && String(AES.getCurrentAirline().id || '') === owner;
    }
    static frontend(doc: Document): AESModel.FrontendSettings {
        for (const script of doc.querySelectorAll('script')) {
            const match = (script.textContent || '').match(/(?:window\.)?frontendSettings\s*=\s*(\{[\s\S]*?\})\s*;/);
            if (match) { try { const value: unknown = JSON.parse(match[1]); if (AES.isRecord(value)) return value; } catch { /* Reject below. */ } }
        }
        throw new Error('The response is not a logged-in AirlineSim page. Please reload and sign in.');
    }
    static date(doc: Document) {
        const source = AESRead.frontend(doc).server?.time;
        const time = new Date(source || '');
        if (!Number.isFinite(time.getTime())) throw new Error('Server time is missing from the response.');
        const iso = time.toISOString();
        return {date:iso.slice(0,10).replace(/-/g,''), time:iso.slice(11,16)+' UTC'};
    }
    static async fetchDocument(input: string, current = AESRead.context()) {
        const url = new URL(input, location.href);
        const readFlight = url.pathname === '/action/info/flight' && /^\d+$/.test(url.searchParams.get('id') || '') && [...url.searchParams.keys()].every(k => k === 'id');
        const readEnterprise = /^\/app\/info\/enterprises\/\d+$/.test(url.pathname) && ['0','2','3'].includes(url.searchParams.get('tab') || '') && [...url.searchParams.keys()].every(k => k === 'tab');
        if (url.origin !== location.origin || url.username || url.password || url.hash || (!readFlight && !readEnterprise)) throw new Error('Unsupported read-only page.');
        if (!current()) throw new Error('The requesting page or airline changed.');
        const owner = String(AES.getCurrentAirline().id);
        const slot = await AES.queuePage(url.href, 'read', current);
        const controller = new AbortController();
        const abort = () => controller.abort();
        const timer = window.setTimeout(abort, 20000);
        const monitor = window.setInterval(() => {if (!current()) abort();},100);
        window.addEventListener('pagehide', abort, {once:true});
        try {
            if (!current() || Date.now() >= (slot.expires || 0)) throw new Error('Read request expired or page changed.');
            const response = await fetch(url.href, {method:'GET', credentials:'same-origin', signal:controller.signal});
            if (!response.ok) throw new Error('Page request failed (HTTP ' + response.status + ').');
            const returned = new URL(response.url);
            const path = (u: URL) => u.pathname.replace(/;[^/]+/g,'');
            if (returned.origin !== url.origin || path(returned) !== path(url) || (readFlight && returned.searchParams.get('id') !== url.searchParams.get('id'))) throw new Error('The request was redirected to another page.');
            const html = await response.text();
            if (!current() || controller.signal.aborted || Date.now() >= (slot.expires || 0)) throw new Error('Read request expired or page changed.');
            const doc = new DOMParser().parseFromString(html, 'text/html');
            if (String(AESRead.frontend(doc).fixedEnterpriseId || '') !== owner) throw new Error('The active airline changed. Reload before collecting data.');
            if (readEnterprise && !doc.querySelector('.nav-tabs .tab'+url.searchParams.get('tab')+'.active')) throw new Error('The response contains the wrong enterprise tab.');
            await slot.complete();
            return doc;
        } catch (error) {
            controller.abort(); await slot.cancel(); throw error;
        } finally {
            window.clearTimeout(timer);window.clearInterval(monitor);window.removeEventListener('pagehide',abort);
        }
    }
    static async save(message: Record<string, unknown>, current: () => boolean) {
        if (!current()) throw new Error('The requesting page or airline changed.');
        const token = crypto.randomUUID();
        AESRead.saves.set(token,current);
        try {
            await new Promise<void>((resolve,reject) => chrome.runtime.sendMessage({...message,token}, (response: unknown) => {
                if (chrome.runtime.lastError) {reject(new Error(chrome.runtime.lastError.message));return;}
                if (!AES.isRecord(response) || response.ok !== true) {reject(new Error(AES.isRecord(response) ? String(response.error) : 'Storage unavailable.'));return;}
                resolve();
            }));
        } finally {AESRead.saves.delete(token);}
    }
    static async collectSchedule(airline: AESModel.Airline, progress: (message: string) => void, current = AESRead.context()) {
        const doc = await AESRead.fetchDocument('/app/info/enterprises/'+airline.id+'?tab=3',current);
        const schedule = await AESRead.parseSchedule(doc,progress,current);
        const time = AESRead.date(doc);
        progress('Saving '+schedule.length.toLocaleString()+' routes...');
        await AESRead.save({type:'AES_SAVE_SCHEDULE',airline,snapshot:{date:time.date,updateTime:time.time,schedule}},current);
    }
    static async parseSchedule(doc: Document, progress: (message: string) => void, current: () => boolean) {
        let processed = 0, turnRows = 0, turnStarted = performance.now();
        const yieldToPage = async () => {
            await AES.sleep(0);
            if (!current()) throw new Error('The page or schedule changed during extraction. Please try again.');
            turnRows=0;turnStarted=performance.now();
        };
        const needsYield = () => ++turnRows >= 100 || performance.now()-turnStarted >= 8;
        await yieldToPage();
        const schedule: AESModel.ScheduleRoute[] = [];
        for (const tbody of doc.querySelectorAll('.flight-schedule table tbody')) {
            let destinationCount = 0;
            let route: Partial<AESModel.ScheduleRoute> = {};
            // Walking siblings avoids materializing a second array of every flight row.
            for (let child = tbody.firstElementChild; child; child = child.nextElementSibling) {
                if (!(child instanceof HTMLTableRowElement)) continue;
                const cls = child.className;
                if (cls === 'important origin') {
                    route.origin = AESRead.cellText(child, 'a');
                } else if (cls === 'destination') {
                    if (destinationCount && AESRead.completeRoute(route)) schedule.push(route);
                    if (destinationCount) route = {origin: route.origin};
                    route.destination = AESRead.cellText(child, 'a');
                    destinationCount++;
                } else if (cls !== 'head') {
                    const remark = AESRead.cellText(child, '.remarks');
                    if (!remark.includes('via')) route = AESRead.lineDetails(child, route, remark);
                }
                processed++;
                if (needsYield()) {
                    progress('Extracting... ' + processed.toLocaleString() + ' rows processed');
                    await yieldToPage();
                }
            }
            if (AESRead.completeRoute(route)) schedule.push(route);
        }
        if (!schedule.length) throw new Error('No flight segments found. Existing schedule data was kept.');

        progress('Preparing ' + schedule.length.toLocaleString() + ' routes...');
        const hub: Record<string, number> = {};
        for (const route of schedule) {
            hub[route.origin] = (hub[route.origin] || 0) + 1;
            if (needsYield()) await yieldToPage();
        }
        for (const route of schedule) {
            if (hub[route.origin] > hub[route.destination]) { route.od = route.origin + route.destination; route.direction = 'Outbound'; }
            else if (hub[route.origin] < hub[route.destination]) { route.od = route.destination + route.origin; route.direction = 'Inbound'; }
            else if (route.origin < route.destination) { route.od = route.origin + route.destination; route.direction = 'Outbound'; }
            else { route.od = route.destination + route.origin; route.direction = 'Inbound'; }
            if (needsYield()) await yieldToPage();
        }

        if (!current()) throw new Error('The requesting page or airline changed.');
        return schedule;
    }
    static async collectCompetitor(airline: AESModel.Airline, progress: (message: string) => void, current = AESRead.context()) {
        const ownerAirline = AES.getCurrentAirline();
        progress('Fetching overview...');
        const overviewDoc = await AESRead.fetchDocument('/app/info/enterprises/'+airline.id+'?tab=0',current);
        const heading = overviewDoc.querySelector('.nav-tabs')?.parentElement?.parentElement?.querySelector('h2')?.textContent?.trim();
        if (!heading) throw new Error('Enterprise heading is missing.');
        const target = {...airline, displayName:heading, name:heading.replace(/ /g,'_')};
        const overview = AESRead.overview(overviewDoc,target), overviewTime = AESRead.date(overviewDoc);
        if (!overview.rating || ![overview.pax,overview.cargo,overview.stations,overview.fleet,overview.employees].every(Number.isFinite)) throw new Error('Incomplete competitor overview.');
        progress('Fetching facts and figures...');
        const factsDoc = await AESRead.fetchDocument('/app/info/enterprises/'+airline.id+'?tab=2',current);
        const facts = AESRead.facts(factsDoc), factsTime = AESRead.date(factsDoc);
        if (![facts.week,facts.airportsServed,facts.operatedFlights,facts.seatsOffered,facts.sko,facts.cargoOffered,facts.fko].every(Number.isFinite)) throw new Error('Incomplete competitor facts and figures.');
        progress('Fetching schedule...');
        await AESRead.collectSchedule(target,progress,current);
        progress('Saving competitor data...');
        await AESRead.save({type:'AES_SAVE_COMPETITOR',airline:target,ownerAirline,
            overview:{...overview,date:overviewTime.date,updateTime:overviewTime.time},
            facts:{...facts,date:factsTime.date,updateTime:factsTime.time}},current);
    }
static overview(doc: Document, currentAirline: AESModel.Airline): AESModel.CompetitorOverview {
    const data: AESModel.CompetitorOverview = {
        ...currentAirline, rating: '', pax: NaN, cargo: NaN, stations: NaN,
        fleet: NaN, employees: NaN, tab0data: 1
    };
    //First table
    let table = $(".layout-col-md-4 > .as-fieldset:eq(0) table tbody",doc);
    data.rating = $('td:eq(1)', $('tr', table).last()).text().trim().replace(/[^A-Za-z0-9]/g, '');
    //Second Table
    table = $(".layout-col-md-4 > .as-fieldset:eq(1) table tbody",doc);
    data.pax = parseInt(table.find('tr:eq(0) td:eq(1)').text().trim().replace(/\D/g, ''), 10);
    data.cargo = parseInt(table.find('tr:eq(1) td:eq(1)').text().trim().replace(/\D/g, ''), 10);
    data.stations = parseInt(table.find('tr:eq(2) td:eq(1)').text().trim().replace(/\D/g, ''), 10);
    data.fleet = parseInt(table.find('tr:eq(3) td:eq(1)').text().trim().replace(/\D/g, ''), 10);
    data.employees = parseInt(table.find('tr:eq(4) td:eq(1)').text().trim().replace(/\D/g, ''), 10);
    data.tab0data = 1;
    return data;
}

static facts(doc: Document): AESModel.CompetitorFacts {
    //First table
    const data: AESModel.CompetitorFacts = {
        week: NaN, airportsServed: NaN, operatedFlights: NaN, seatsOffered: NaN,
        sko: NaN, cargoOffered: NaN, fko: NaN, tab2data: 2
    };
    let table = $(".tab-content table",doc);
    let getNumber = function(text: string) {
        let number = text.trim().split('(')[0].replace(/\D/g, '');
        return number ? parseInt(number, 10) : NaN;
    };
    let getNumberByLabel = function(labels: string[], fallbackCell: JQuery) {
        let value: number | undefined;
        table.find('tbody tr').each(function() {
            let label = $(this).find('th, td').first().text().trim().toLowerCase();
            let found = labels.some(function(match) {
                return label.indexOf(match) != -1;
            });
            if (found) {
                value = getNumber($(this).find('td:eq(1)').text());
                return false;
            }
        });
        if (value !== undefined) {
            return value;
        }
        return getNumber(fallbackCell.text());
    };

    data.week = parseInt(table.find('tr:eq(0) th:eq(2)').text().trim().replace(/\D/g, ''), 10);
    data.airportsServed = getNumberByLabel(['airports served'], table.find('tbody:eq(0) tr:eq(0) td:eq(1)'));
    data.operatedFlights = getNumberByLabel(['operated flights'], table.find('tbody:eq(0) tr:eq(1) td:eq(1)'));
    data.seatsOffered = getNumberByLabel(['seats offered'], table.find('tbody:eq(1) tr:eq(2) td:eq(1)'));
    data.sko = getNumberByLabel(['seat kilometer offered', 'sko'], table.find('tbody:eq(1) tr:eq(5) td:eq(1)'));
    data.cargoOffered = getNumberByLabel(['units offered'], table.find('tbody:eq(2) tr:eq(2) td:eq(1)'));
    data.fko = getNumberByLabel(['freight kilometer offered', 'fko'], table.find('tbody:eq(2) tr:eq(5) td:eq(1)'));
    data.tab2data = 2;
    return data;
}

    static flight(doc: Document, id: number): AESModel.FlightInfoRecord {
        if (!doc.querySelector('#privInf') || !doc.querySelector('#flight-page > ul > li.active')) throw new Error('Private flight financial data is unavailable.');
        const rows = [...doc.querySelectorAll('.cm')];
        if (rows.length !== 5) throw new Error('Incomplete flight financial data.');
        const money: AESModel.FlightFinancials = {};
        const labels: AESModel.FinancialColumn[] = ['Y','C','F','PAX','Cargo','Total'];
        rows.forEach((row,index) => {
            const cells = [...row.querySelectorAll('td')];
            if (cells.length !== labels.length) throw new Error('Incomplete flight financial columns.');
            const values: Partial<Record<AESModel.FinancialColumn,number>> = {};
            cells.forEach((cell,i) => {
                const text = (cell.textContent || '').trim().replace(/−/g,'-');
                const cleaned = text.replace(/AS\$|[,\s.]/g,'');
                const emptyCabin = i !== 5 && ['', '-', '—', '–'].includes(cleaned);
                if (!emptyCabin && !/^-?\d+$/.test(cleaned)) throw new Error('Invalid flight financial value.');
                const value = emptyCabin ? 0 : AES.cleanInteger(text);
                if (!Number.isSafeInteger(value)) throw new Error('Invalid flight financial value.');
                values[labels[i]]=value;
            });
            money['CM'+(index+1)]=values;
        });
        return {type:'flightInfo',server:AES.getServerName(),flightId:id,money,...AESRead.date(doc)};
    }
static cellText(row: HTMLTableRowElement, selector: string) {
    return row.querySelector(selector)?.textContent || '';
}

static lineDetails(row: HTMLTableRowElement, route: Partial<AESModel.ScheduleRoute>, remark: string) {
    // parse flight number
    let parts = AESRead.cellText(row, '.code').trim().split(/\s+/);
    let flightNumber = parseInt(parts[1], 10);

    if (!/^\d+$/.test(parts[1] || '') || !Number.isSafeInteger(flightNumber)) return route;

    // ensure container
    if (!route.flightNumber) route.flightNumber = {};

    // always re-initialize the entry
    let valid  = AESRead.cellText(row, '.valid');

    route.flightNumber[flightNumber] = {
        paxFreq:   0,
        cargoFreq: 0,
        remark,
        valid
    };

    // count days: cargo vs pax based on remark
    let days   = AESRead.cellText(row, '.days').split('');
    let isCargo = remark.includes('CARGO FLIGHT');

    for (let d of days) {
        if (d >= '0' && d <= '9') {
            if (isCargo) route.flightNumber[flightNumber].cargoFreq++;
            else         route.flightNumber[flightNumber].paxFreq++;
        }
    }

    return route;
}

static completeRoute(route: Partial<AESModel.ScheduleRoute>): route is AESModel.ScheduleRoute {
    return !!route.origin && !!route.destination && !!route.flightNumber && Object.keys(route.flightNumber).length > 0;
}

}
chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
    if (!AES.isRecord(message) || message.type !== 'AES_SCHEDULE_OWNER_CHECK') return false;
    const current = typeof message.token === 'string' ? AESRead.saves.get(message.token) : undefined;
    reply({ok:sender.id === chrome.runtime.id && !!current?.()});
    return false;
});
