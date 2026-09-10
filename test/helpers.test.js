const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInContext } = require('node:vm');
const { JSDOM } = require('jsdom');
const {coordinator,sender} = require('./support/coordinator.cjs');
const source = file => readFileSync(`${__dirname}/../build/extension/${file}`, 'utf8');
const header = `<div id="header"><div><button aria-haspopup="menu"><div><span class="_code_newhash_19">AES</span></div><div><span class="_name_newhash_46">AES Airlines</span><span>10,000,000 AS$</span></div></button><div role="menubar"><button role="menuitem">Airline</button></div></div></div>`;
const settings = `<script>window.frontendSettings = {"fixedEnterpriseId":13150,"theme":"dark","server":{"time":"2026-09-08T00:43:12.858Z"}};</script>`;
const overview = `<div class="bootstrap container-fluid"><h1>Enterprises</h1><div><h2><span>Acacia Air</span></h2><div class="as-panel"><ul class="nav-tabs"><li class="tab0 active"><a href="./12685?tab=0">Overview</a></li><li><a href="./12685?tab=2">Facts and Figures</a></li></ul><div class="as-table-well"><table><tbody><tr><td>Name</td><td>Acacia Air</td></tr><tr><td>Code</td><td>YY</td></tr></tbody></table></div></div></div></div>`;
function page(html, path = '/app/info/enterprises/12685?tab=0') {
    const dom = new JSDOM(html, { url: `https://paine.airlinesim.aero${path}`, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    const saved = {settings:{invPricing:{recommendation:{Y:{steps:[],minPrice:50,maxPrice:200}}}}};
    Object.defineProperty(w.navigator, 'userAgent', {value:'Chrome/152.0'});
    const evaluate = code => runInContext(code, dom.getInternalVMContext());
    w.chrome = { runtime: { id: 'aes-test', getManifest: () => ({ version:'0.8.12', version_name:'0.8.12' }), getURL: p => p }, storage: { local: {
        get(keys, callback) { const value = { ...saved }; if (callback) callback(value); else return Promise.resolve(value); },
        set(value, callback) { Object.assign(saved, value); if (callback) callback(); else return Promise.resolve(); }
    } } };
    const dispatch=coordinator(w.chrome), identity=sender(w.location.href);
    w.chrome.runtime.sendMessage=(message,reply)=>dispatch(message,identity,reply);
    evaluate(source('js/vendor/jquery-4.0.0.min.js'));
    evaluate(source('helpers.js') + '\nwindow.TestAES = AES; window.AES = AES;');
    return { dom, w, aes: w.TestAES, saved, load: file => evaluate(source(file)), close: () => { w.TestAES._ownershipLostCallbacks.forEach(fn => fn()); w.TestAES._pageControlObserver.disconnect(); w.close(); } };
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('new header separates controlled airline from viewed competitor without a cache', () => {
    const p = page(settings + header + overview);
    assert.equal(p.aes.getCurrentAirline().id, '13150');
    assert.equal(p.aes.getCurrentAirline().displayName, 'AES Airlines');
    assert.equal(p.aes.getCurrentAirline().code, 'AES');
    assert.equal(p.aes.getAirline().id, '12685');
    assert.equal(p.aes.getAirline().displayName, 'Acacia Air');
    assert.equal(p.aes.getAirline().code, 'YY');
    assert.equal(p.aes.getServerDate().date, '20260908');
    assert.equal(p.aes.getServerDate().time, '00:43 UTC');
    p.close();
});
test('operational pages use current airline, never title or unrelated links', () => {
    const p = page(settings + header + '<title>Inventory</title><a href="/app/info/enterprises/999">Other airline</a>', '/app/com/inventory/123');
    assert.equal(p.aes.getAirline().name, 'AES_Airlines');
    assert.equal(p.aes.getAirline().id, '13150');
    p.close();
});
test('legacy navigation and header-based container discovery remain supported', () => {
    const p = page(`<nav class="as-navbar-main"><ul class="navbar-nav"><li class="dropdown"><a class="name"><span>Legacy Air</span></a><ul class="dropdown-menu"><li><a href="/app/enterprise/dashboard?select=42"><span>Legacy Air</span></a></li></ul></li></ul></nav><div class="container-fluid"></div><div class="container-fluid"><h1>Settings</h1></div>`, '/app/enterprise/settings');
    assert.equal(p.aes.getCurrentAirline().id, '42');
    assert.equal(p.aes.getAirline().name, 'Legacy_Air');
    assert.ok(p.aes.getPageContainer().querySelector('h1'));
    p.close();
});
test('new header hydration delays content initialization and runs it only once', async () => {
    const p = page(settings + '<div id="header"></div>');
    let starts = 0;
    p.aes.runContentScript('content:test', () => { starts++; assert.equal(p.aes.getCurrentAirline().name, 'AES_Airlines'); }, { ready:false });
    assert.equal(starts, 0);
    p.w.document.getElementById('header').outerHTML = header;
    await pause(180);
    assert.equal(starts, 1);
    p.w.document.body.append(p.w.document.createElement('div'));
    await pause(150);
    assert.equal(starts, 1);
    p.close();
});
test('settings renders once in the single new content container and cleans up ownership', async () => {
    const p = page(settings + header + '<div class="bootstrap container-fluid"><h1>Settings</h1></div>', '/app/enterprise/settings');
    p.load('content_settings.js');
    await pause(50);
    assert.deepEqual(Object.keys(p.aes._reportedErrors || {}), []);
    assert.equal(p.w.document.querySelectorAll('#aes-settings-root').length, 1);
    assert.ok(p.w.document.querySelector('#aes-settings-root').textContent.includes('Inventory Pricing'));
    p.aes._ownershipLostCallbacks.forEach(fn => fn());
    assert.equal(p.w.document.querySelectorAll('#aes-settings-root').length, 0);
    p.close();
});
test('competitor panel mounts in the new layout with correct owner data', async () => {
    const p = page(settings + header + overview);
    p.load('content_enterpriseOverview.js');
    await pause(50);
    assert.equal(p.w.document.querySelectorAll('#aes-panel-airline-competitive-monitoring').length, 1);
    assert.equal(p.aes._competitorPageData.ownerId, '13150');
    assert.equal(p.aes._competitorPageData.id, '12685');
    assert.equal(p.aes._competitorPageData.key, 'paine13150_12685competitorMonitoring');
    p.close();
});
test('menu works without Bootstrap JS, remounts after React replacement, and cleans up', async () => {
    const p = page(settings + header + overview);
    p.load('modules/aes-menu.js');
    p.load('modules/about-dialog.js');
    const d = p.w.document;
    const button = d.querySelector('#aes-menu > button');
    assert.equal(d.querySelector('#aes-menu').previousElementSibling.getAttribute('role'), 'menubar');
    button.click();
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    assert.equal(d.querySelector('#aes-menu-items').hidden, false);
    d.dispatchEvent(new p.w.KeyboardEvent('keydown', { key:'Escape' }));
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    button.click();
    d.body.click();
    assert.equal(d.querySelector('#aes-menu-items').hidden, true);
    let shown = false;
    d.querySelector('#aes-about-dialog').showModal = () => { shown = true; };
    d.querySelector('#aes-menu-items button').click();
    assert.ok(shown);
    assert.equal(d.querySelector('#aes-about-dialog').tagName, 'DIALOG');
    d.getElementById('header').outerHTML = header;
    await pause(250);
    assert.equal(d.querySelectorAll('#aes-menu').length, 1);
    p.aes._ownershipLostCallbacks.forEach(fn => fn());
    assert.equal(d.querySelectorAll('#aes-menu, #aes-about-dialog').length, 0);
    p.close();
});
test('menu remains valid inside legacy navbar lists', () => {
    const p = page('<nav class="as-navbar-main"><ul class="navbar-nav"><li>Database</li></ul></nav>');
    p.load('modules/aes-menu.js');
    assert.equal(p.w.document.querySelector('#aes-menu').tagName, 'LI');
    assert.ok(p.w.document.querySelector('#aes-menu').classList.contains('dropdown'));
    assert.ok(p.w.document.querySelector('#aes-menu-items').classList.contains('dropdown-menu'));
    assert.ok(p.w.document.querySelector('#aes-menu > a .caret'));
    assert.equal(p.w.document.querySelector('#aes-menu .aes-menu-icon'), null);
    const menu = p.w.document.querySelector('#aes-menu');
    const toggle = menu.querySelector('a');
    menu.dispatchEvent(new p.w.MouseEvent('mouseenter'));
    assert.equal(p.w.document.querySelector('#aes-menu-items').hidden, false);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    menu.dispatchEvent(new p.w.MouseEvent('mouseleave'));
    assert.equal(p.w.document.querySelector('#aes-menu-items').hidden, true);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(menu.classList.contains('open'), false);
    p.w.document.querySelector('#aes-menu > a').click();
    assert.ok(p.w.document.querySelector('#aes-menu').classList.contains('open'));
    assert.equal(p.w.document.querySelector('#aes-menu-items').hidden, false);
    p.close();
});
test('notifications mount within new scoped game styles', () => {
    const p = page('<div class="bootstrap container-fluid"><h1>Test</h1></div>');
    p.load('modules/notification.js');
    p.load('modules/notifications.js');
    runInContext('new Notifications().add("Test", {duration:0});', p.dom.getInternalVMContext());
    assert.ok(p.w.document.querySelector('.bootstrap .feedbackPanel'));
    p.close();
});
test('dashboard waits for the new header and renders with the controlled airline', async () => {
    const p = page(settings + '<div id="header"></div><div class="bootstrap container-fluid"><h1>Dashboard</h1><div id="enterprise-dashboard"></div></div>', '/app/enterprise/dashboard');
    p.load('content_dashboard.js');
    await pause(30);
    assert.equal(p.w.document.querySelector('#aes-dashboard-root'), null);
    p.w.document.getElementById('header').outerHTML = header;
    await pause(180);
    assert.equal(p.w.document.querySelectorAll('#aes-dashboard-root').length, 1);
    assert.equal(p.saved.settings.general.dashboardFilterScopeKey, 'paine:13150');
    assert.deepEqual(Object.keys(p.aes._reportedErrors || {}), []);
    p.close();
});

test('waitForElement preserves selector, collection and legacy scalar readiness', t => {
    const p = page('<div id="ready"></div>');
    t.after(p.close);
    const element = p.w.document.getElementById('ready');
    for (const value of [element, [element], p.w.document.querySelectorAll('#ready'), p.w.$('#ready'), true, 1, 'AES Airlines']) {
        let received;
        p.aes.waitForElement(() => value, target => { received = target; });
        assert.equal(received, value);
    }
    for (const value of [false, 0, '', null, undefined, [], p.w.$('.missing')]) {
        let called = false;
        const waiter = p.aes.waitForElement(() => value, () => { called = true; });
        assert.equal(called, false);
        waiter.disconnect();
    }
    let received;
    p.aes.waitForElement(['.missing', '#ready'], value => { received = value; });
    assert.equal(received, element);
});

test('frontend settings retain theme and validate airline and clock fields', t => {
    const p = page(settings + header);
    t.after(p.close);
    assert.equal(p.aes.getFrontendSettings().theme, 'dark');
    p.w.frontendSettings = { fixedEnterpriseId: {}, theme: 'light', server: { time: [] }, extra: 42 };
    const parsed = p.aes.getFrontendSettings();
    assert.equal(parsed.fixedEnterpriseId, undefined);
    assert.equal(parsed.server, undefined);
    assert.equal(parsed.theme, 'light');
    assert.equal(parsed.extra, 42);
    assert.throws(() => p.aes.getServerDate(), /Unable to read/);
});

test('airline lookup accepts legacy numeric IDs and rejects malformed entries', t => {
    const p = page(header);
    t.after(p.close);
    p.w.localStorage.setItem('paine_airlinesData', JSON.stringify({ AES_Airlines: { id: 42, code: 'AA', extra: true } }));
    assert.equal(p.aes.getCurrentAirline().id, '42');
    assert.equal(JSON.parse(p.w.localStorage.getItem('paine_airlinesData')).AES_Airlines.extra, true);
    p.w.localStorage.setItem('paine_airlinesData', JSON.stringify({ AES_Airlines: { id: {}, code: [] } }));
    assert.equal(p.aes.getCurrentAirline().id, null);
});

test('notification options retain duration and fade behavior without shadowing the native name', t => {
    const p = page('<div class="bootstrap container-fluid"></div>');
    t.after(p.close);
    const nativeNotification = p.w.Notification;
    p.load('modules/notification.js');
    p.load('modules/notifications.js');
    const timers = [];
    p.w.setTimeout = (fn, delay) => { timers.push({ fn, delay }); return timers.length; };
    runInContext('new Notifications().add("Warning", {type:"warning", duration:100, fadeDuration:20});', p.dom.getInternalVMContext());
    const notification = p.w.document.querySelector('.feedbackPanelWARNING');
    assert.ok(notification);
    assert.equal(timers[0].delay, 100);
    timers[0].fn();
    assert.equal(notification.classList.contains('aes-notification-exit'), true);
    assert.equal(timers[1].delay, 20);
    timers[1].fn();
    assert.equal(notification.isConnected, false);
    assert.equal(p.w.Notification, nativeNotification);
});

test('date and numeric helpers preserve calculation results', t => {
    const p = page('');
    t.after(p.close);
    assert.equal(p.aes.getDateDiff(['20240301', '20240228']), 2);
    assert.equal(p.aes.getDateDiff(['20240228', '20240301']), -2);
    assert.equal(p.aes.formatDateStringWeek(212024), '21/2024');
    assert.equal(p.aes.cleanInteger('-2,000 AS$'), -2000);
    assert.equal(p.aes.cleanInteger(256), 256);
    assert.equal(p.aes.cleanInteger('Unavailable'), 0);
});

test('overlapping enterprise and schedule scripts initialize together in manifest order', async t => {
    const p = page(settings + header + overview.replace('tab0 active', 'tab3 active') + '<div class="flight-schedule"></div>', '/app/info/enterprises/12685?tab=3');
    t.after(p.close);
    p.load('content_flightSchedule.js');
    p.load('content_enterpriseOverview.js');
    await pause(50);
    assert.deepEqual(Object.keys(p.aes._reportedErrors), []);
    assert.equal(p.w.document.querySelectorAll('#aes-panel-schedule').length, 1);
    assert.equal(p.w.document.querySelectorAll('#aes-panel-airline-competitive-monitoring').length, 1);
    assert.equal(p.aes._competitorPageData.ownerAirline.id, '13150');
    assert.equal(p.aes._competitorPageData.id, '12685');
});
