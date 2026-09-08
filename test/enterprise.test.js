const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser, until } = require('./support/browser.cjs');
const owner = { id: '42', name: 'AES_Airlines', displayName: 'AES Airlines', code: 'AA' };
const airline = { id: '99', name: 'Other_Air', displayName: 'Other Air', code: 'OA' };
const key = 'paine42_99competitorMonitoring';
const header = `<script>window.frontendSettings = {"fixedEnterpriseId":42,"server":{"time":"2026-09-08T00:00:00Z"}};</script>
<div id="header"><div><button aria-haspopup="menu"><span class="_name_test">AES Airlines</span><span class="_code_test">AA</span></button><div role="menubar"></div></div></div>`;
const overview = `<div class="as-table-well"><table><tbody><tr><td>Name</td><td>Other Air</td></tr><tr><td>Code</td><td>OA</td></tr></tbody></table></div>
<div class="layout-col-md-4"><div class="as-fieldset"><table><tbody><tr><td>Rating</td><td>AAA</td></tr></tbody></table></div>
<div class="as-fieldset"><table><tbody>${['1,000','200','3','4','50'].map(n => `<tr><td>Metric</td><td>${n}</td></tr>`).join('')}</tbody></table></div></div>`;
const facts = `<div class="tab-content"><table><thead><tr><th>Metric</th><th>Value</th><th>Week 362026</th></tr></thead><tbody>
${[['Airports served','3'],['Operated flights','28'],['Seats offered','2,800'],['Seat kilometer offered','500,000'],['Units offered','400'],['Freight kilometer offered','60,000']].map(([label,n]) => `<tr><td>${label}</td><td>${n}</td></tr>`).join('')}
</tbody></table></div>`;
const line = (number, days, remark = '') => `<tr><td class="code">OA ${number}</td><td class="days">${days}</td><td class="remarks">${remark}</td><td class="valid">Now</td></tr>`;
const schedule = `<div class="flight-schedule"><table><tbody>
<tr class="important origin"><td><a>AAA</a></td></tr><tr class="destination"><td><a>BBB</a></td></tr>
${line(100,'12345')}${line(101,'67','CARGO FLIGHT')}${line(102,'1234567','via CCC')}
<tr class="destination"><td><a>CCC</a></td></tr>${line(103,'135')}
</tbody><tbody><tr class="important origin"><td><a>BBB</a></td></tr><tr class="destination"><td><a>AAA</a></td></tr>${line(104,'1234567')}
</tbody></table></div>`;
function html(tab, body = '') {
    return header + `<div class="bootstrap container-fluid"><h1>Enterprises</h1><div><h2><span>Other Air</span></h2><div class="as-panel"><ul class="nav-tabs"><li class="tab${tab} active">Tab</li></ul>${body}</div></div></div>`;
}
function competitor(extra = {}) {
    return { key, server: 'paine', id: '99', ownerId: '42', ownerAirline: owner, type: 'competitorMonitoring', tracking: 0, autoExtract: 0, tab0: {}, tab2: {}, ...extra };
}
function enterprise(t, tab, body, data = {}) {
    const p = browser(t, { html: html(tab, body), path: `/app/info/enterprises/99?tab=${tab}`, data });
    const navigations = [];
    p.w.open = (...args) => { navigations.push(args); return null; };
    return { ...p, navigations };
}

test('overview saves owner-scoped history and updates a deduplicated tracking index', async t => {
    const p = enterprise(t, 0, overview, { [key]: competitor({ tab0: { '20260901': { old: true } }, extra: 'keep' }), paine42competitorMonitoringIndex: ['7','7'] });
    p.load('content_enterpriseOverview.js');
    await until(() => p.w.document.querySelector('#aes-panel-airline-competitive-monitoring input'));
    const checkbox = p.w.document.querySelector('#aes-panel-airline-competitive-monitoring input');
    checkbox.click();
    p.w.document.querySelector('#aes-btn-save-tab0-data').click();
    assert.deepEqual(p.saved.paine42competitorMonitoringIndex, ['7','99']);
    assert.deepEqual(p.saved[key].tab0['20260901'], { old: true });
    assert.deepEqual(p.saved[key].tab0['20260908'], { ...airline, rating: 'AAA', pax: 1000, cargo: 200, stations: 3, fleet: 4, employees: 50, tab0data: 1, updateTime: '00:00 UTC', date: '20260908' });
    assert.equal(p.saved[key].extra, 'keep');
    checkbox.click();
    assert.equal(p.saved[key].tracking, 0);
    assert.deepEqual(p.saved.paine42competitorMonitoringIndex, ['7']);
});

test('facts automation keeps previous history and navigates to the schedule tab', async t => {
    const p = enterprise(t, 2, facts, { [key]: competitor({ tracking: 1, autoExtract: 1, tab2: { '20260901': { week: 352026 } } }) });
    p.load('content_enterpriseOverview.js');
    await until(() => p.navigations.length > 0);
    assert.deepEqual(p.saved[key].tab2['20260908'], { week: 362026, airportsServed: 3, operatedFlights: 28, seatsOffered: 2800, sko: 500000, cargoOffered: 400, fko: 60000, tab2data: 2, updateTime: '00:00 UTC', date: '20260908' });
    assert.deepEqual(p.saved[key].tab2['20260901'], { week: 352026 });
    assert.deepEqual(p.navigations, [['./99?tab=3', '_self']]);
});

test('same-week facts are not overwritten during automation', async t => {
    const p = enterprise(t, 2, facts, { [key]: competitor({ tracking: 1, autoExtract: 1, tab2: { '20260907': { week: 362026, extra: 'keep' } } }) });
    p.load('content_enterpriseOverview.js');
    await until(() => p.navigations.length > 0);
    assert.deepEqual(p.saved[key].tab2, { '20260907': { week: 362026, extra: 'keep' } });
    assert.deepEqual(p.navigations, [['./99?tab=3', '_self']]);
});

test('schedule extraction preserves segment splitting, frequencies and old snapshots', async t => {
    const p = enterprise(t, 3, schedule, { settings: {}, paine99schedule: { type: 'schedule', server: 'paine', airline, date: { '20260901': { old: true } }, extra: 'keep' } });
    p.load('content_flightSchedule.js');
    p.load('content_enterpriseOverview.js');
    await until(() => p.w.document.querySelector('#aes-panel-airline-competitive-monitoring'));
    p.w.document.querySelector('#aes-extractSchedule-btn').click();
    const result = p.saved.paine99schedule;
    assert.deepEqual(result.date['20260901'], { old: true });
    assert.equal(result.extra, 'keep');
    assert.deepEqual(result.airline, { ...airline, code: '' });
    const routes = result.date['20260908'].schedule;
    assert.deepEqual(routes.map(r => [r.origin,r.destination,r.od,r.direction]), [
        ['AAA','BBB','AAABBB','Outbound'], ['AAA','CCC','AAACCC','Outbound'], ['BBB','AAA','AAABBB','Inbound']
    ]);
    assert.deepEqual(routes[0].flightNumber, { '100': { paxFreq: 5, cargoFreq: 0, remark: '', valid: 'Now' },
        '101': { paxFreq: 0, cargoFreq: 2, remark: 'CARGO FLIGHT', valid: 'Now' } });
    assert.equal(routes[1].flightNumber['103'].paxFreq, 3);
    assert.equal(p.errors.length, 0);
});

test('legacy competitor automation finishes under the owner key without deleting the legacy record', async t => {
    const legacyKey = 'paine99competitorMonitoring';
    const record = competitor({ key: legacyKey, autoExtract: 1, tracking: 1 });
    const p = enterprise(t, 3, schedule, { settings: {}, [legacyKey]: record });
    p.load('content_flightSchedule.js');
    await until(() => p.navigations.length > 0);
    assert.equal(p.saved[key].autoExtract, 0);
    assert.equal(p.saved[key].ownerId, '42');
    assert.deepEqual(p.saved[legacyKey], record);
    assert.deepEqual(p.navigations, [['./99?tab=0','_self']]);
});

test('settings-triggered extraction resets only its flag and preserves other preferences', async t => {
    const p = enterprise(t, 3, schedule, { settings: { schedule: { autoExtract: 1, extra: true }, keep: 42 } });
    p.load('content_flightSchedule.js');
    await until(() => p.saved.paine99schedule);
    assert.deepEqual(p.saved.settings, { schedule: { autoExtract: 0, extra: true }, keep: 42 });
    assert.equal(p.navigations.length, 0);
});

test('delayed competitor reads cannot resurrect completed automation in either callback order', async t => {
    for (const reverse of [false, true]) {
        const p = enterprise(t, 3, schedule, { settings: {}, [key]: competitor({ autoExtract: 1, tracking: 1 }) });
        const get = p.w.chrome.storage.local.get;
        const pending = [];
        p.w.chrome.storage.local.get = (keys, callback) => get(keys, value => {
            if (Array.isArray(keys) && keys.includes(key)) pending.push(() => callback(value));
            else callback(value);
        });
        p.load('content_flightSchedule.js');
        p.load('content_enterpriseOverview.js');
        await until(() => pending.length === 2);
        if (reverse) pending.reverse();
        pending.forEach(finish => finish());
        assert.equal(p.saved[key].autoExtract, 0);
        assert.equal(p.navigations.length, 1);
        assert.ok(p.saved.paine99schedule.date['20260908']);
        assert.equal(p.errors.length, 0);
    }
});

test('empty or unparseable schedules leave history intact and the extract button usable', async t => {
    for (const body of ['<div class="flight-schedule"><table><tbody><tr><td>No flights</td></tr></tbody></table></div>', schedule.replace(/OA \d+/g, 'Invalid')]) {
        const stored = { type: 'schedule', date: { '20260908': { keep: true } } };
        const p = enterprise(t, 3, body, { settings: {}, paine99schedule: stored });
        p.load('content_flightSchedule.js');
        await until(() => p.w.document.querySelector('#aes-extractSchedule-btn'));
        p.w.document.querySelector('#aes-extractSchedule-btn').click();
        assert.deepEqual(p.saved.paine99schedule, stored);
        assert.equal(p.calls.length, 0);
        assert.equal(p.w.document.querySelector('#aes-extractSchedule-btn').disabled, false);
        assert.match(p.w.document.querySelector('#aes-schedule-status').textContent, /No flight segments/);
    }
});

test('failed schedule writes do not complete automation or navigate, and can be retried', async t => {
    const p = enterprise(t, 3, schedule, { settings: {}, [key]: competitor({ autoExtract: 1 }) });
    p.failures.set = 'Write failed';
    p.load('content_flightSchedule.js');
    await until(() => p.w.document.querySelector('#aes-schedule-status')?.textContent.includes('Write failed'));
    assert.equal(p.saved[key].autoExtract, 1);
    assert.equal(p.navigations.length, 0);
    assert.equal(p.saved.paine99schedule, undefined);
    delete p.failures.set;
    p.w.document.querySelector('#aes-extractSchedule-btn').click();
    assert.ok(p.saved.paine99schedule);
    assert.equal(p.saved[key].autoExtract, 0);
    assert.equal(p.navigations.length, 1);
});

test('failed history reads preserve stored snapshots and allow retry', async t => {
    const original = { type: 'schedule', date: { '20260901': { keep: true } } };
    const p = enterprise(t, 3, schedule, { settings: {}, paine99schedule: original });
    p.load('content_flightSchedule.js');
    await until(() => p.w.document.querySelector('#aes-extractSchedule-btn'));
    p.failures.get = 'Read failed';
    p.w.document.querySelector('#aes-extractSchedule-btn').click();
    assert.deepEqual(p.saved.paine99schedule, original);
    assert.equal(p.calls.length, 0);
    assert.equal(p.w.document.querySelector('#aes-extractSchedule-btn').disabled, false);
});

test('overview automation does not navigate after its history write fails', async t => {
    const p = enterprise(t, 0, overview, { [key]: competitor({ tracking: 1, autoExtract: 1 }) });
    const set = p.w.chrome.storage.local.set;
    p.w.chrome.storage.local.set = (values, callback) => {
        if (values[key]?.tab0?.['20260908']) p.failures.set = 'History write failed';
        return set(values, callback);
    };
    p.load('content_enterpriseOverview.js');
    await until(() => p.calls.some(c => c.values?.[key]?.tab0?.['20260908']));
    assert.equal(p.navigations.length, 0);
    assert.equal(p.saved[key].tab0['20260908'], undefined);
});

test('starting all-tab extraction on the facts tab persists the flag before navigation', async t => {
    const p = enterprise(t, 2, facts, { [key]: competitor({ tracking: 1 }) });
    p.load('content_enterpriseOverview.js');
    await until(() => Array.from(p.w.document.querySelectorAll('button')).some(b => b.textContent === 'save all tab data'));
    const button = Array.from(p.w.document.querySelectorAll('button')).find(b => b.textContent === 'save all tab data');
    button.click();
    assert.equal(p.saved[key].autoExtract, 1);
    assert.deepEqual(p.navigations, [['./99?tab=0', '_self']]);
});

test('failed tracking writes restore the checkbox and leave the index unchanged', async t => {
    const p = enterprise(t, 0, overview, { [key]: competitor(), paine42competitorMonitoringIndex: ['7'] });
    p.load('content_enterpriseOverview.js');
    await until(() => p.w.document.querySelector('#aes-panel-airline-competitive-monitoring input'));
    p.failures.set = 'Tracking failed';
    const checkbox = p.w.document.querySelector('#aes-panel-airline-competitive-monitoring input');
    checkbox.click();
    assert.equal(checkbox.checked, false);
    assert.equal(checkbox.disabled, false);
    assert.equal(p.saved[key].tracking, 0);
    assert.deepEqual(p.saved.paine42competitorMonitoringIndex, ['7']);
});

test('schedule completion failure retains the automation flag and supports retry', async t => {
    const p = enterprise(t, 3, schedule, { settings: {}, [key]: competitor({ autoExtract: 1 }) });
    const set = p.w.chrome.storage.local.set;
    p.w.chrome.storage.local.set = (values, callback) => {
        if (values[key]) p.failures.set = 'Flag write failed';
        return set(values, callback);
    };
    p.load('content_flightSchedule.js');
    await until(() => p.w.document.querySelector('#aes-schedule-status')?.textContent.includes('Flag write failed'));
    assert.ok(p.saved.paine99schedule);
    assert.equal(p.saved[key].autoExtract, 1);
    assert.equal(p.navigations.length, 0);
    p.w.chrome.storage.local.set = set;
    delete p.failures.set;
    p.w.document.querySelector('#aes-extractSchedule-btn').click();
    assert.equal(p.saved[key].autoExtract, 0);
    assert.equal(p.navigations.length, 1);
});

test('ownership loss prevents a pending schedule read from saving or navigating', async t => {
    const p = enterprise(t, 3, schedule, { settings: {} });
    p.load('content_flightSchedule.js');
    await until(() => p.w.document.querySelector('#aes-extractSchedule-btn'));
    const get = p.w.chrome.storage.local.get;
    let finish;
    p.w.chrome.storage.local.get = (keys, callback) => get(keys, value => { finish = () => callback(value); });
    p.w.document.querySelector('#aes-extractSchedule-btn').click();
    p.w.document.getElementById('aes-page-control').setAttribute('data-owner', 'other-extension');
    await until(() => !p.run('AES.isPageOwner()'));
    finish();
    assert.equal(p.saved.paine99schedule, undefined);
    assert.equal(p.navigations.length, 0);
});

test('malformed history containers are tolerated and unrelated record fields survive', async t => {
    const p = enterprise(t, 0, overview, { [key]: competitor({ tracking: 1, tab0: null, tab2: { invalid: null }, extra: { keep: true } }) });
    p.load('content_enterpriseOverview.js');
    await until(() => p.w.document.querySelector('#aes-btn-save-tab0-data'));
    p.w.document.querySelector('#aes-btn-save-tab0-data').click();
    assert.ok(p.saved[key].tab0['20260908']);
    assert.deepEqual(p.saved[key].tab2, { invalid: null });
    assert.deepEqual(p.saved[key].extra, { keep: true });
    assert.equal(p.errors.length, 0);
    assert.equal(p.w.document.body.textContent.includes('NaN'), false);
});

test('numeric flight number zero retains the legacy extraction behavior', async t => {
    const p = enterprise(t, 3, schedule.replace('OA 100', 'OA 0'), { settings: {} });
    p.load('content_flightSchedule.js');
    await until(() => p.w.document.querySelector('#aes-extractSchedule-btn'));
    p.w.document.querySelector('#aes-extractSchedule-btn').click();
    assert.equal(p.saved.paine99schedule.date['20260908'].schedule[0].flightNumber['0'].paxFreq, 5);
});
