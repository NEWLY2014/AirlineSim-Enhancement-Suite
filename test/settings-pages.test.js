const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser, until } = require('./support/browser.cjs');
const header = `<script>window.frontendSettings = {"fixedEnterpriseId":42,"server":{"time":"2026-09-08T00:00:00Z"}};</script>
<div id="header"><div><button aria-haspopup="menu"><span class="_name_test">AES Airlines</span></button><div role="menubar"></div></div></div>`;
const pricing = () => ({ recommendation: Object.fromEntries(['Y','C','F','Cargo'].map(cabin => [cabin, {
    minPrice: 60, maxPrice: 200, steps: [{ min: 0, max: 100, name: 'Keep', step: 0 }]
}])) });

test('settings edits preserve unrelated and newly stored preferences', async t => {
    const p = browser(t, { html: header + '<div class="bootstrap container-fluid"><h1>Settings</h1></div>',
        path: '/app/enterprise/settings', data: { settings: { invPricing: pricing(), custom: { keep: true } } } });
    p.load('content_settings.js');
    await until(() => p.w.document.querySelector('#aes-input-automateInvPricing'));
    p.saved.settings.addedAfterLoad = 'keep';
    p.w.document.querySelector('#aes-input-automateInvPricing').click();
    assert.equal(p.saved.settings.invPricing.autoPriceUpdate, 1);
    assert.equal(p.saved.settings.addedAfterLoad, 'keep');
    assert.deepEqual(p.saved.settings.custom, { keep: true });
    p.w.document.querySelectorAll('#aes-settings-root .col-md-2 a')[1].click();
    p.w.document.querySelector('#aes-div-settingArea input').click();
    assert.equal(p.saved.settings.flightInfo.autoClose, 1);
    assert.equal(p.saved.settings.invPricing.autoPriceUpdate, 1);
});

test('pricing editor saves valid steps and rejects invalid price bounds', async t => {
    const p = browser(t, { html: header + '<div class="bootstrap container-fluid"><h1>Settings</h1></div>',
        path: '/app/enterprise/settings', data: { settings: { invPricing: pricing() } } });
    p.load('content_settings.js');
    await until(() => p.w.document.querySelector('#aes-btn-invPricing-save'));
    p.w.document.querySelector('#aes-input-invPricing-min-price').value = '70';
    p.w.document.querySelector('#aes-btn-invPricing-save').click();
    assert.equal(p.saved.settings.invPricing.recommendation.Y.minPrice, 70);
    assert.equal(p.saved.settings.invPricing.recommendation.C.minPrice, 60);
    const writes = p.calls.length;
    p.w.document.querySelector('#aes-input-invPricing-min-price').value = '201';
    p.w.document.querySelector('#aes-btn-invPricing-save').click();
    assert.equal(p.calls.length, writes);
    assert.match(p.w.document.querySelector('#aes-span-invPricing').textContent, /Save Failed/);
});

const staff = header + `<div class="bootstrap container-fluid"><h1>Employee Overview</h1><table>
<thead><tr><th>Staff</th><th>Next week's salary</th><th>Country average</th></tr></thead>
<tbody><tr><td>Pilots</td><td><form><input name="action" value="salary" type="hidden"><input name="amount" value="800"><button type="submit">Save salary</button></form></td><td>1,000 AS$</td></tr></tbody></table></div>`;

test('personnel applies percentage and absolute targets through salary forms only', async t => {
    for (const [type, value, target] of [['perc', 10, '1100'], ['absolute', 50, '1050']]) {
        const p = browser(t, { html: staff, path: '/action/enterprise/staffOverview', data: {
            settings: { personnelManagement: { type, value, auto: 0, alreadyUpdated: [] }, keep: true }
        } });
        let submissions = 0;
        p.w.document.addEventListener('submit', event => { event.preventDefault(); submissions++; });
        p.load('modules/notification.js');
        p.load('modules/notifications.js');
        p.load('content_personnelManagement.js');
        await until(() => p.w.document.querySelector('.aes-personnel-management-apply'));
        p.w.document.querySelector('.aes-personnel-management-apply').click();
        await until(() => submissions > 0);
        assert.equal(p.w.document.querySelector('input[name="amount"]').value, target);
        assert.equal(submissions, 1);
        assert.equal(p.saved.settings.personnelManagement.auto, 0);
        assert.equal(p.saved.settings.keep, true);
        assert.equal(p.saved.paine42personnelManagement.date, '20260908');
        assert.equal(p.errors.length, 0);
    }
});

test('personnel stops automation and restores the action button when no salary table exists', async t => {
    const p = browser(t, { html: header + '<div class="bootstrap container-fluid"><h1>Employee Overview</h1></div>', path: '/action/enterprise/staffOverview', data: { settings: {} } });
    p.load('modules/notification.js');
    p.load('modules/notifications.js');
    p.load('content_personnelManagement.js');
    await until(() => p.w.document.querySelector('.aes-personnel-management-apply'));
    const button = p.w.document.querySelector('.aes-personnel-management-apply');
    button.click();
    assert.equal(button.disabled, false);
    assert.equal(p.saved.settings.personnelManagement.auto, 0);
    assert.ok(p.w.document.querySelector('.feedbackPanelERROR'));
    assert.equal(p.saved.paine42personnelManagement, undefined);
});

test('pricing step boundary errors display feedback instead of throwing', async t => {
    const p = browser(t, { html: header + '<div class="bootstrap container-fluid"><h1>Settings</h1></div>',
        path: '/app/enterprise/settings', data: { settings: { invPricing: pricing() } } });
    p.load('content_settings.js');
    await until(() => p.w.document.querySelector('#aes-btn-invPricing-save'));
    const inputs = p.w.document.querySelectorAll('#aes-table-invPricing tbody input');
    inputs[1].value = '10';
    p.w.document.querySelector('#aes-btn-invPricing-save').click();
    assert.match(p.w.document.querySelector('#aes-span-invPricing').textContent, /must start at 0/);
    inputs[1].value = '0';
    inputs[2].value = '90';
    p.w.document.querySelector('#aes-btn-invPricing-save').click();
    assert.match(p.w.document.querySelector('#aes-span-invPricing').textContent, /must end at 100/);
    assert.equal(p.calls.length, 0);
    assert.equal(p.errors.length, 0);
});

test('settings renders incomplete preferences without saving fallback values', async t => {
    const p = browser(t, { html: header + '<div class="bootstrap container-fluid"><h1>Settings</h1></div>',
        path: '/app/enterprise/settings', data: { settings: { custom: true } } });
    p.load('content_settings.js');
    await until(() => p.w.document.querySelector('#aes-btn-invPricing-save'));
    assert.equal(p.w.document.querySelector('#aes-input-invPricing-min-price').value, '60');
    assert.deepEqual(p.saved.settings, { custom: true });
    assert.equal(p.calls.length, 0);
});

test('personnel normalizes old numeric settings and keeps page state isolated', async t => {
    const p = browser(t, { html: staff, path: '/action/enterprise/staffOverview', data: {
        settings: { personnelManagement: { type: 'absolute', value: '50', auto: 0, custom: true } }
    } });
    p.run('var settings = { sentinel: true }; var server = "other"; var airline = { id: "999" };');
    p.load('content_personnelManagement.js');
    await until(() => p.w.document.querySelector('.aes-personnel-management-apply'));
    assert.equal(p.w.document.querySelector('#aes-input-personnelManagement-value').value, '50');
    assert.equal(p.saved.settings.personnelManagement.value, 50);
    assert.equal(p.saved.settings.personnelManagement.custom, true);
    assert.equal(p.run('settings.sentinel'), true);
    assert.equal(p.run('server'), 'other');
    assert.equal(p.run('airline.id'), '999');
});
