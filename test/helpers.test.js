const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInContext } = require('node:vm');
const { JSDOM } = require('jsdom');
const source = file => readFileSync(`${__dirname}/../extension/${file}`, 'utf8');
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
    evaluate(source('js/vendor/jquery-3.7.1.slim.min.js'));
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
    assert.equal(p.w.compData.ownerId, '13150');
    assert.equal(p.w.compData.id, '12685');
    assert.equal(p.w.compData.key, 'paine13150_12685competitorMonitoring');
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
    p.w.document.querySelector('#aes-menu > a').click();
    assert.ok(p.w.document.querySelector('#aes-menu').classList.contains('open'));
    assert.equal(p.w.document.querySelector('#aes-menu-items').hidden, false);
    p.close();
});
test('notifications mount within new scoped game styles', () => {
    const p = page('<div class="bootstrap container-fluid"><h1>Test</h1></div>');
    p.w.eval(source('modules/notification.js') + '\nwindow.Notification = Notification;');
    p.w.eval(source('modules/notifications.js') + '\nnew Notifications().add("Test", {duration:0});');
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
    assert.equal(p.w.airline.name, 'AES_Airlines');
    assert.equal(p.w.airline.id, '13150');
    assert.deepEqual(Object.keys(p.aes._reportedErrors || {}), []);
    p.close();
});
