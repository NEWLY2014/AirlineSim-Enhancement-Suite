const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const source = readFileSync(`${__dirname}/../build/extension/background.js`, 'utf8');
const snapshot = value => JSON.parse(JSON.stringify(value));

function background(settings) {
    const saved = { settings };
    const listeners = {};
    const opened = [];
    const chrome = {
        runtime: {
            onInstalled: { addListener(fn) { listeners.install = fn; } },
            onMessage: { addListener(fn) { listeners.message = fn; } }
        },
        storage: { local: {
            get(keys, callback) { callback(saved); },
            set(value, callback) { Object.assign(saved, snapshot(value)); callback?.(); }
        } },
        tabs: { create(options, callback) { opened.push(options); callback({ id: 42 }); } },
        declarativeContent: {
            onPageChanged: { removeRules(ids, callback) { callback(); }, addRules() {} },
            PageStateMatcher: function() {}, ShowAction: function() {}
        }
    };
    runInNewContext(source, { chrome, URL });
    const message = value => {
        let response;
        const pending = listeners.message(value, {}, result => { response = snapshot(result); });
        return { pending, response };
    };
    return { saved, opened, chrome, install: () => listeners.install(), message };
}

test('installation fills defaults without overwriting old settings, arrays or unknown keys', () => {
    const original = {
        general: { defaultDashboard: 'aircraftProfitability', custom: true },
        invPricing: { autoAnalysisSave: 0, recommendation: { Y: { minPrice: 51, steps: [] } } },
        extensionSetting: { enabled: false }
    };
    const before = snapshot(original);
    const b = background(original);
    b.install();
    assert.deepEqual(original, before);
    const saved = b.saved.settings;
    assert.equal(saved.general.defaultDashboard, 'aircraftProfitability');
    assert.equal(saved.general.custom, true);
    assert.equal(saved.invPricing.autoAnalysisSave, 0);
    assert.equal(saved.invPricing.recommendation.Y.minPrice, 51);
    assert.deepEqual(saved.invPricing.recommendation.Y.steps, []);
    assert.equal(saved.invPricing.recommendation.Y.maxPrice, 200);
    assert.equal(saved.invPricing.recommendation.C.steps.length, 7);
    assert.deepEqual(saved.extensionSetting, { enabled: false });
    b.install();
    assert.deepEqual(b.saved.settings, saved);
});

test('installation recovers missing or malformed settings containers', () => {
    for (const value of [undefined, null, [], 'broken', 3]) {
        const b = background(value);
        b.install();
        assert.equal(b.saved.settings.general.defaultDashboard, 'general');
        assert.equal(b.saved.settings.invPricing.recommendation.Cargo.minPrice, 60);
    }
    const b = background({ invPricing: { recommendation: [] } });
    b.install();
    assert.equal(b.saved.settings.invPricing.recommendation.F.maxPrice, 200);
});

test('background opens only supported flight URLs and preserves active-tab behavior', () => {
    const b = background();
    const url = 'https://paine.airlinesim.aero/action/info/flight?id=123';
    assert.deepEqual(b.message({ type: 'AES_OPEN_TAB', url, active: true }), {
        pending: true, response: { ok: true, tabId: 42 }
    });
    assert.deepEqual(snapshot(b.opened[0]), { active: true, url });
    b.message({ type: 'AES_OPEN_TAB', url, active: 'true' });
    assert.equal(b.opened[1].active, false);
    for (const invalid of [null, 123, {}, 'http://paine.airlinesim.aero/action/info/flight?id=1',
        'https://paine.airlinesim.aero.evil.test/action/info/flight?id=1',
        'https://paine.airlinesim.aero/app/fleets', 'https://paine.airlinesim.aero/action/info/flight']) {
        const result = b.message({ type: 'AES_OPEN_TAB', url: invalid });
        assert.equal(result.pending, false);
        assert.equal(result.response.ok, false);
    }
    assert.equal(b.opened.length, 2);
    assert.deepEqual(b.message(null), { pending: false, response: undefined });
    assert.deepEqual(b.message({ type: 'other' }), { pending: false, response: undefined });
});

test('background reports Chrome tab creation errors', () => {
    const b = background();
    b.chrome.runtime.lastError = { message: 'Tab unavailable' };
    assert.deepEqual(b.message({ type: 'AES_OPEN_TAB', url: 'https://paine.airlinesim.aero/action/info/flight?id=1' }).response,
        { ok: false, error: 'Tab unavailable' });
});
