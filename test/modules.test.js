const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser, until, snapshot } = require('./support/browser.cjs');
const frontend = '<script>window.frontendSettings = {"theme":"light","server":{"time":"2026-09-08T00:43:12Z"}};</script>';

test('release dialog follows theme, paginates and records the version on dismissal', t => {
    const p = browser(t, { html: frontend + '<footer id="footer"><span id="version">v1.2.3</span></footer>' });
    p.load('modules/release-notes.js');
    const dialog = p.w.document.querySelector('#aes-release-notes-dialog');
    assert.ok(dialog.classList.contains('aes-release-notes-theme-light'));
    assert.match(dialog.querySelector('.modal-title').textContent, /0\.8\.13/);
    const [previous, next] = dialog.querySelectorAll('.aes-release-notes-page-button');
    assert.equal(next.disabled, true);
    previous.click();
    assert.match(dialog.querySelector('.modal-title').textContent, /0\.8\.12/);
    next.click();
    assert.match(dialog.querySelector('.modal-title').textContent, /0\.8\.13/);
    p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(p.saved.aesReleaseNotesSeenVersion, '0.8.13');
    assert.equal(dialog.isConnected, false);
    assert.equal(p.w.document.body.classList.contains('modal-open'), false);
    assert.equal(p.w.document.querySelector('#aes-footer-version').nextElementSibling.id, 'version');
    p.w.document.querySelector('.aes-footer-version-link').click();
    assert.ok(p.w.document.querySelector('#aes-release-notes-dialog'));
});

test('release footer finds explicit elements and plain version text without duplicate links', t => {
    for (const html of ['<nav class="as-navbar-bottom"><div data-version="1.2.3">1.2.3</div></nav>',
        '<footer id="footer">Game version v1.2.3</footer>']) {
        const p = browser(t, { html, data: { aesReleaseNotesSeenVersion: '0.8.13' } });
        p.load('modules/release-notes.js');
        assert.equal(p.w.document.querySelector('#aes-release-notes-dialog'), null);
        assert.ok(p.w.document.querySelector('#aes-footer-version'));
        p.run('addReleaseNotesFooterLink()');
        assert.equal(p.w.document.querySelectorAll('#aes-footer-version').length, 1);
        p.run('AES._ownershipLostCallbacks.forEach(fn => fn())');
        assert.equal(p.w.document.querySelector('#aes-footer-version'), null);
    }
});

const orsHtml = `<div class="ors-result"><div class="as-panel"><div class="as-table-well"><table class="table"><tbody>
<tr><th>Route</th><th class="rating">Rating</th></tr>
<tr class="totals"><td>A-B</td><td class="rating"><img title="Rating: 80"></td></tr>
<tr><td>A-C</td><td class="aircraft"><img title="Comfort: -5"></td></tr>
<tr class="totals"><td>A-D</td><td class="rating"><img title="Rating: 65"></td></tr>
</tbody></table></div></div></div><nav class="navigation"><a href="#next">Next</a></nav>`;

test('ORS keeps rating numbers, differences and maximum across navigation', t => {
    const p = browser(t, { html: orsHtml });
    p.w.localStorage.setItem('tmp_ors_maxRating', '90');
    p.load('modules/onlineReservationSystem/onlineReservationSystem.js');
    assert.equal(p.w.localStorage.getItem('tmp_ors_maxRating'), null);
    assert.deepEqual(Array.from(p.w.document.querySelectorAll('.aes-text-left'), el => el.textContent), ['80', '-5', '65']);
    assert.deepEqual(Array.from(p.w.document.querySelectorAll('.totals .aes-ors-difference'), el => el.textContent), ['10', '25']);
    p.w.document.querySelector('.navigation a').click();
    assert.equal(p.w.localStorage.getItem('tmp_ors_maxRating'), '90');
    p.run('AES._ownershipLostCallbacks.forEach(fn => fn())');
    assert.equal(p.w.document.querySelectorAll('.aes-ors-difference, .aes-text-left').length, 0);
});

const flightHtml = frontend + `<div class="bootstrap container-fluid"><h1>Flight</h1><div id="privInf"></div>
<div id="flight-page"><ul><li class="active">Overview</li></ul></div>
<table><tr class="cm"><td>1,000 AS$</td><td>200 AS$</td><td>300 AS$</td><td>1500</td><td>0</td><td>1500</td></tr>
<tr class="cm"><td>-200 AS$</td><td>0</td><td>0</td><td>-200</td><td>-50</td><td>-250</td></tr></table></div>`;

test('flight info saves financial columns under the existing key and renders them', async t => {
    const p = browser(t, { html: flightHtml, path: '/action/info/flight?id=42', data: { settings: { flightInfo: { autoClose: 0 } } } });
    p.load('modules/notification.js');
    p.load('modules/notifications.js');
    p.load('modules/flightInfo/flightInfo.js');
    await until(() => p.w.document.querySelector('.aes-table'));
    assert.deepEqual(p.saved.paineflightInfo42, { server: 'paine', flightId: 42, type: 'flightInfo', date: '20260908', time: '00:43 UTC',
        money: { CM1: { Y: 1000, C: 200, F: 300, PAX: 1500, Cargo: 0, Total: 1500 },
            CM2: { Y: -200, C: 0, F: 0, PAX: -200, Cargo: -50, Total: -250 } } });
    assert.equal(p.w.document.querySelectorAll('.aes-table tbody tr').length, 2);
    assert.equal(p.errors.length, 0);
});

const inventoryHtml = `<div class="col-md-10"><div><div class="as-panel"></div><div class="as-panel">
<ul><li class="active">All Flight Numbers</li></ul><div><div><div>
<fieldset></fieldset><fieldset></fieldset><fieldset><div>
<input type="checkbox" checked><input type="checkbox" checked><input type="checkbox"><input type="checkbox">
</div></fieldset></div><div><div class="layout-col-md-3">
<fieldset><label>Economy<input type="checkbox" checked></label><label>Business<input type="checkbox" checked></label></fieldset>
<fieldset><label>First<input type="checkbox"></label><label>Second<input type="checkbox" checked></label><label>Third<input type="checkbox" checked></label></fieldset>
<fieldset><div><label>Min</label><select><option selected>0</option></select></div><div><label>Max</label><select><option selected>100</option></select></div></fieldset>
</div></div></div></div></div></div></div>`;

test('inventory validation retains selection rules and reports missing controls', t => {
    const p = browser(t, { html: inventoryHtml });
    p.load('modules/inventory/validation.js');
    let result = snapshot(p.run('new Validation()'));
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    p.w.document.querySelector('input').checked = false;
    result = snapshot(p.run('new Validation()'));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(message => message.includes('Airport Pair')));
    p.w.document.body.replaceChildren();
    result = snapshot(p.run('new Validation()'));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(message => message.includes('layout might have changed')));
});

test('release dialog drops keyboard handlers when page ownership is lost', t => {
    const p = browser(t, { html: frontend });
    p.load('modules/release-notes.js');
    assert.ok(p.w.document.querySelector('#aes-release-notes-dialog'));
    p.run('AES._ownershipLostCallbacks.forEach(fn => fn())');
    const writes = p.calls.length;
    p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(p.calls.length, writes);
    assert.equal(p.saved.aesReleaseNotesSeenVersion, undefined);
    assert.equal(p.w.document.querySelector('#aes-release-notes-dialog'), null);
});

test('ORS ignores a corrupt saved maximum instead of displaying NaN', t => {
    const p = browser(t, { html: orsHtml });
    p.w.localStorage.setItem('tmp_ors_maxRating', 'corrupt');
    p.load('modules/onlineReservationSystem/onlineReservationSystem.js');
    assert.deepEqual(Array.from(p.w.document.querySelectorAll('.totals .aes-ors-difference'), el => el.textContent), ['0', '15']);
});

test('flight info rejects invalid IDs and reports save failures', async t => {
    for (const id of ['', '-1', '42oops', '9007199254740992']) {
        const p = browser(t, { html: flightHtml, path: `/action/info/flight?id=${id}` });
        p.load('modules/notification.js');
        p.load('modules/notifications.js');
        p.load('modules/flightInfo/flightInfo.js');
        await until(() => p.errors.length > 0);
        assert.equal(Object.keys(p.saved).some(key => key.includes('flightInfo')), false);
    }
    const p = browser(t, { html: flightHtml, path: '/action/info/flight?id=42' });
    p.failures.set = 'Storage unavailable';
    p.load('modules/notification.js');
    p.load('modules/notifications.js');
    p.load('modules/flightInfo/flightInfo.js');
    await until(() => p.errors.length > 0);
    assert.equal(p.saved.paineflightInfo42, undefined);
    assert.ok(p.w.document.querySelector('.feedbackPanelERROR'));
});

test('flight info displays a missing financial cell without inventing a zero', async t => {
    const p = browser(t, { html: flightHtml.replace('<td>-250</td>', ''), path: '/action/info/flight?id=42' });
    p.load('modules/notification.js');
    p.load('modules/notifications.js');
    p.load('modules/flightInfo/flightInfo.js');
    await until(() => p.w.document.querySelector('.aes-table'));
    assert.equal(p.w.document.querySelector('.aes-table tbody tr:last-child td:last-child').textContent, '—');
    assert.equal(p.saved.paineflightInfo42.money.CM2.Total, undefined);
});
