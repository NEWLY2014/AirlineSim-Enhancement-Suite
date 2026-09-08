const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser, until } = require('./support/browser.cjs');
const header = `<script>window.frontendSettings = {"fixedEnterpriseId":42,"server":{"time":"2026-09-08T00:00:00Z"}};</script><div id="header"><div><button aria-haspopup="menu"><span class="_name_test">AES Airlines</span><span class="_code_test">AA</span></button><div role="menubar"></div></div></div>`;
const fleetKey = 'paine42aircraftFleet';
const aircraftRow = (id, registration, model = 'A320') => `<tr><td><input type="checkbox" name="aircraftsContainer" checked></td><td><span>${registration}</span><div>...</div></td><td><a>${model}</a></td><td></td><td><span>2,5 years</span><div><span></span><span>95,5%</span></div></td><td><span>100</span><span>10</span><span>0</span><div class="subrow">Yes</div></td><td></td><td><span><span>Note</span></span>${id ? `<a title="Flight Planning" class="btn-success" href="/app/fleets/aircraft/${id}/0"></a>` : ''}</td></tr>`;
function fleet(t, rows, data = {}) {
    return browser(t, { data, html: header + `<div class="as-page-fleet-management"><h1>Fleet</h1><div class="row"><div class="col-md-9"><h2>Main</h2><div class="as-panel"><table><thead><tr>${Array.from({length:8}, () => '<th>Aircraft model</th>').join('')}</tr></thead><tbody>${rows}</tbody></table></div></div></div></div>` });
}
const flightRow = (id, origin, destination, depart, arrive, status = 'finished') => `<tr><td></td><td>AA ${id}</td><td><span>${origin}</span></td><td><span>${depart} UTC</span></td><td><span>${destination}</span></td><td><span>${arrive} UTC</span></td><td class="flightStatusPanel">${status}</td><td><a href="/action/info/flight?id=${id}">Details</a></td></tr>`;
function flights(t, rows, data = {}) {
    const p = browser(t, { data, path: '/app/fleets/aircraft/123/1', html: header + `<h1><span>AA-123</span><span>A320</span></h1><div class="as-table-well"><table id="aircraft-flight-instances-table"><thead><tr>${Array.from({length:8}, () => '<th>Column</th>').join('')}</tr></thead><tbody>${rows}</tbody></table></div>` });
    Object.defineProperty(p.w.HTMLElement.prototype, 'innerText', { get() { return this.textContent; }, set(v) { this.textContent = v; }, configurable: true });
    return p;
}
const rows = flightRow(1, 'AAA', 'BBB', '08.09. 01:00', '08.09. 03:00') + flightRow(2, 'BBB', 'AAA', '08.09. 04:00', '08.09. 06:00', 'inflight');

test('fleet merges registration-only aircraft, preserves other fleets and removes stale current rows', async t => {
    const p = fleet(t, aircraftRow(123, 'AA-123') + aircraftRow(null, 'AA-NEW'), { [fleetKey]: { fleet: [{ registration: 'AA-123', fleet: 'Main', hubOverride: 'CCC', extra: 'keep' }, {aircraftId: 9, registration:'OLD', fleet:'Other'}, {aircraftId:8, registration:'REMOVED',fleet:'Main'}, {fleet:'Other'}] } });
    p.load('content_fleetManagement.js');
    await until(() => p.w.document.querySelector('#aes-fleet-management-root'));
    const stored = p.saved[fleetKey].fleet;
    assert.equal(stored.length, 3);
    assert.equal(stored[0].aircraftId, 123);
    assert.equal(stored[0].extra, 'keep');
    assert.equal(stored[0].hubEffective, 'CCC');
    assert.equal(stored[0].age, 2.5);
    assert.equal(stored[0].maintenance, 95.5);
    assert.equal(stored[0].seatConfig, '100/10/0');
    assert.equal(stored[1].registration, 'AA-NEW');
    assert.equal(stored[1].aircraftId, null);
    assert.equal(stored[2].aircraftId, 9);
    assert.ok(stored.every(a => !('row' in a)));
});

test('fleet filters hide mismatched models and clear hidden aircraft selection', async t => {
    const p = fleet(t, aircraftRow(123, 'AA-123') + aircraftRow(124, 'AA-124', 'B737'));
    p.load('content_fleetManagement.js');
    await until(() => p.w.document.querySelector('#aes-fleet-management-root select'));
    p.w.$('#aes-fleet-management-root select').first().val('A320').trigger('change');
    const aircraft = p.w.document.querySelectorAll('.aes-fleet-table tbody tr');
    assert.equal(aircraft[0].style.display, '');
    assert.equal(aircraft[1].style.display, 'none');
    assert.equal(aircraft[1].querySelector('input').checked, false);
    p.w.$('#aes-fleet-management-root button').trigger('click');
    assert.equal(aircraft[1].style.display, '');
});

test('aircraft flights sum stored profits and preserve fleet HUB override', async t => {
    const p = flights(t, rows, { [fleetKey]: { fleet: [{aircraftId:123, hubOverride:'CCC', extra:'keep'}] }, paineflightInfo1: {flightId:1, money:{CM5:{Total:100}},date:'20260907',time:'00:00 UTC'}, paineflightInfo2: {flightId:2,money:{CM5:{Total:-20}},date:'20260908',time:'00:00 UTC'} });
    p.load('content_aircraftFlights.js');
    await until(() => p.w.document.querySelector('.aes-aircraft-flights-block'));
    assert.equal(p.saved.paineaircraftFlights123.profit, 80);
    assert.equal(p.saved.paineaircraftFlights123.profitFlights, 2);
    assert.equal(p.saved.paineaircraftFlights123.hubDetected, 'AAA');
    assert.equal(p.saved.paineaircraftFlights123.hubEffective, 'CCC');
    assert.equal(p.saved[fleetKey].fleet[0].extra, 'keep');
    assert.match(p.w.document.querySelector('.aes-aircraft-flights-sequence-cell').textContent, /Valid sequence/);
    assert.equal(p.w.document.querySelectorAll('.aes-aircraft-flights-extra-cell').length, 4);
});

test('aircraft sequence flags overlaps and airport discontinuity but excludes cancelled flights', async t => {
    const p = flights(t, flightRow(1,'AAA','BBB','31.12. 23:00','01.01. 01:00') + flightRow(2,'CCC','AAA','01.01. 00:30','01.01. 02:00') + flightRow(3,'','','bad','bad','cancelled'));
    p.load('content_aircraftFlights.js');
    await until(() => p.w.document.querySelector('.aes-aircraft-flights-block'));
    assert.match(p.w.document.querySelector('.aes-aircraft-flights-sequence-cell').textContent, /2 issues found.*2 checked/);
    assert.equal(p.w.document.querySelectorAll('.aes-aircraft-flights-sequence-issue-row').length, 2);
});

test('empty fleet placeholder removes only the current fleet', async t => {
    const p = fleet(t, '<tr><td colspan="8">No aircraft</td></tr>', { [fleetKey]: {fleet:[{aircraftId:1, fleet:'Main'}, {aircraftId:2, fleet:'Other'}]} });
    p.load('content_fleetManagement.js');
    await until(() => p.saved[fleetKey].fleet.length === 1);
    assert.equal(p.saved[fleetKey].fleet[0].aircraftId, 2);
});

test('failed fleet reads and writes do not report a successful update', async t => {
    for (const operation of ['get','set']) {
        const original = {fleet:[{aircraftId:9, registration:'OLD',fleet:'Main'}]};
        const p = fleet(t, aircraftRow(123,'AA-123'), {[fleetKey]:original});
        p.failures[operation] = 'Storage unavailable';
        p.load('content_fleetManagement.js');
        await until(() => p.errors.length);
        assert.deepEqual(p.saved[fleetKey], original);
        assert.equal(p.w.document.querySelector('#aes-fleet-management-root'), null);
        if (operation === 'get') assert.ok(!p.calls.some(c => c.values?.[fleetKey]));
    }
});

test('malformed profit records and malformed flight links do not break the summary', async t => {
    const p = flights(t, rows + flightRow('bad','AAA','BBB','08.09. 08:00','08.09. 09:00'), {paineflightInfo1:{flightId:1,money:null},paineflightInfo2:{flightId:2,money:{CM5:{Total:'100'}},date:'20260908',time:'00:00 UTC'}});
    p.load('content_aircraftFlights.js');
    await until(() => p.w.document.querySelector('.aes-aircraft-flights-block'));
    assert.equal(p.saved.paineaircraftFlights123.totalFlights, 2);
    assert.equal(p.saved.paineaircraftFlights123.profit, 0);
    assert.equal(p.saved.paineaircraftFlights123.profitFlights, 0);
    assert.equal(p.errors.length, 0);
});

test('stored flight-plan HUB takes precedence and override can be saved and reset', async t => {
    const p = flights(t, rows, {[fleetKey]:{extra:'keep',fleet:[{aircraftId:123,hubOverride:'CCC'}]},paine42aircraftFlightPlanHub123:{type:'aircraftFlightPlanHub',aircraftId:123,hub:'DDD',counts:{DDD:5,bad:'invalid'}}});
    p.load('content_aircraftFlights.js');
    await until(() => p.w.document.querySelector('.aes-aircraft-flights-block'));
    assert.equal(p.saved.paineaircraftFlights123.hubDetected, 'DDD');
    assert.equal(p.saved.paineaircraftFlights123.hubDetectionSource, 'flightPlan');
    assert.deepEqual(p.saved.paineaircraftFlights123.hubCounts, {DDD:5});
    p.w.$('.aes-aircraft-flights-hub-input').val('bbb');
    p.w.$('button').filter((i,e) => e.textContent === 'Save HUB override').trigger('click');
    assert.equal(p.saved[fleetKey].fleet[0].hubOverride, 'BBB');
    assert.equal(p.saved.paineaircraftFlights123.hubEffective, 'BBB');
    p.w.$('button').filter((i,e) => e.textContent === 'Reset to default').trigger('click');
    assert.equal(p.saved.paineaircraftFlights123.hubEffective, 'DDD');
    assert.equal(p.saved[fleetKey].fleet[0].hubOverride, '');
    assert.equal(p.saved[fleetKey].extra, 'keep');
});

test('failed aircraft reads preserve the previous summary and failed HUB writes show no success', async t => {
    const p = flights(t, rows, {paineaircraftFlights123:{profit:777}});
    p.failures.get = 'Read failed';
    p.load('content_aircraftFlights.js');
    await until(() => p.errors.length);
    assert.deepEqual(p.saved.paineaircraftFlights123,{profit:777});
    assert.equal(p.w.document.querySelector('.aes-aircraft-flights-block'),null);
    const q = flights(t, rows, {[fleetKey]:{fleet:[{aircraftId:123,hubOverride:'CCC'}]}});
    q.load('modules/notification.js'); q.load('modules/notifications.js');
    q.load('content_aircraftFlights.js');
    await until(() => q.w.document.querySelector('.aes-aircraft-flights-block'));
    q.failures.set = 'Write failed';
    q.w.$('.aes-aircraft-flights-hub-input').val('BBB');
    q.w.$('button').filter((i,e) => e.textContent === 'Save HUB override').trigger('click');
    assert.equal(q.saved[fleetKey].fleet[0].hubOverride,'CCC');
    assert.equal(q.w.document.querySelector('#aes-aircraft-hub-effective').textContent,'CCC');
    assert.doesNotMatch(q.w.document.querySelector('.feedbackPanel').textContent,/HUB override saved/);
    assert.match(q.w.document.querySelector('.feedbackPanel').textContent,/could not be read or saved/);
});

test('pending storage reads stop after page ownership is lost in both modules', async t => {
    for (const [p, file, key] of [[fleet(t,aircraftRow(123,'AA-123')),'content_fleetManagement.js',fleetKey], [flights(t,rows),'content_aircraftFlights.js','paineaircraftFlights123']]) {
        let pending;
        const originalGet = p.w.chrome.storage.local.get;
        p.w.chrome.storage.local.get = (keys, callback) => { pending = () => originalGet(keys,callback); };
        p.load(file);
        await until(() => pending);
        assert.equal(p.saved[key],undefined);
        p.run('AES.isPageOwner = () => false');
        pending();
        assert.equal(p.saved[key],undefined);
        assert.equal(p.w.document.querySelector('#aes-fleet-management-root, .aes-aircraft-flights-block'),null);
    }
});

test('extraction opens only finished/inflight flights and reports background failures', async t => {
    const p = flights(t, rows + flightRow(3,'AAA','BBB','09.09. 01:00','09.09. 03:00','scheduled'));
    const opened = [];
    p.w.chrome.runtime.sendMessage = (message, callback) => { opened.push(message); callback({ok:opened.length === 1, error:'blocked'}); };
    p.w.open = () => null;
    p.load('content_aircraftFlights.js');
    await until(() => p.w.document.querySelector('.aes-aircraft-flights-block'));
    p.w.$('button').filter((i,e) => e.textContent === 'Extract finished flight data').trigger('click');
    await until(() => /Opened 1\/2/.test(p.w.document.querySelector('.aes-aircraft-flights-extract-status').textContent));
    assert.deepEqual(opened.map(m => m.url), ['https://paine.airlinesim.aero/action/info/flight?id=1','https://paine.airlinesim.aero/action/info/flight?id=2']);
    assert.ok(opened.every(m => m.active === false));
    assert.equal(p.w.document.querySelector('.aes-aircraft-flights-extract-btn').disabled,false);
});

test('legacy nullable HUB fields survive fleet refresh and valid profits are displayed', async t => {
    const other = {aircraftId:'9', registration:'OTHER',fleet:'Other',hubDetected:null,hubOverride:null,extra:'keep'};
    const p = fleet(t, aircraftRow(123,'AA-123'), {[fleetKey]:{fleet:[other]},paineaircraftFlights123:{aircraftId:123,date:'20260908',time:'00:00 UTC',finishedFlights:2,totalFlights:2,profit:80,profitFlights:2,hubDetected:'AAA',hubOverride:null}});
    p.load('content_fleetManagement.js');
    await until(() => p.w.document.querySelector('#aes-fleet-management-root'));
    assert.deepEqual(p.saved[fleetKey].fleet[1],other);
    assert.equal(p.saved[fleetKey].fleet[0].hubDetected,'AAA');
    assert.match(p.w.document.querySelector('.aes-fleet-table tbody').textContent,/80/);
});

test('aircraft startup waits for profit and fleet reads before replacing a saved summary', async t => {
    const p = flights(t, rows, {paineaircraftFlights123:{profit:777},paineflightInfo1:{flightId:1,money:{CM5:{Total:100}},date:'20260908',time:'00:00 UTC'}});
    const pending = [];
    const originalGet = p.w.chrome.storage.local.get;
    p.w.chrome.storage.local.get = (keys,callback) => { pending.push(() => originalGet(keys,callback)); };
    p.load('content_aircraftFlights.js');
    await until(() => pending.length);
    assert.equal(pending.length,1);
    assert.equal(p.saved.paineaircraftFlights123.profit,777);
    pending.shift()();
    assert.equal(pending.length,1);
    assert.equal(p.saved.paineaircraftFlights123.profit,777);
    pending.shift()();
    assert.equal(p.saved.paineaircraftFlights123.profit,100);
    assert.equal(p.saved.paineaircraftFlights123.profitFlights,1);
});

test('aircraft table reconciles extra columns after a native column-span update', async t => {
    const p = flights(t, rows);
    p.load('content_aircraftFlights.js');
    await until(() => p.w.document.querySelector('.aes-aircraft-flights-block'));
    const table = p.w.document.querySelector('#aircraft-flight-instances-table');
    const footer = p.w.document.createElement('tr');
    footer.innerHTML = '<td colspan="8">Totals</td>';
    table.createTFoot().append(footer);
    await until(() => footer.firstChild.colSpan === 10);
    assert.equal(p.w.document.querySelectorAll('.aes-aircraft-flights-extra-header').length,2);
});
