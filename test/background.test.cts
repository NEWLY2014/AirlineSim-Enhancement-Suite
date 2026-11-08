import type { Reply,VMValue } from './support/fixtures.cts';
const { test } = (require('node:test') as typeof import('node:test'));
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { readFileSync } = (require('node:fs') as typeof import('node:fs'));
const { runInNewContext } = (require('node:vm') as typeof import('node:vm'));
const source = readFileSync(`${__dirname}/../build/extension/background.js`, 'utf8');
const snapshot = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function background(settings: VMValue) {
    const saved: Record<string, VMValue> = { settings };
    const listeners: Record<string, (...args: VMValue[]) => VMValue> = {};
    const opened: { options: boolean; }[] = [];
    const chrome = {
        runtime: {
            id:'aes-test',
            async openOptionsPage(){opened.push({options:true});},
            onInstalled: { addListener(fn: (...args: VMValue[]) => VMValue) { listeners.install = fn; } },
            onMessage: { addListener(fn: (...args: VMValue[]) => VMValue) { listeners.message = fn; } }
        },
        storage: { local: {
            get(keys: VMValue, callback: Reply) { callback(saved); },
            set(value: Record<string, VMValue>, callback?: () => void) { Object.assign(saved, snapshot(value)); callback?.(); }
        } },
        tabs: { create(options: { options: boolean; }, callback: (arg0: { id: number; }) => void) { opened.push(options); callback({ id: 42 }); } },
        declarativeContent: {
            onPageChanged: { removeRules(ids: VMValue, callback: Reply) { callback(); }, addRules() {} },
            PageStateMatcher: function() {}, ShowAction: function() {}
        }
    };
    runInNewContext(source, { chrome, URL, importScripts() {} });
    const message = (value: VMValue,sender={}) => {
        let response;
        const pending = listeners.message(value, sender, (result: VMValue) => { response = snapshot(result); });
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
    assert.equal(saved!.general.defaultDashboard, 'aircraftProfitability');
    assert.equal(saved!.general.custom, true);
    assert.equal(saved!.invPricing.autoAnalysisSave, 0);
    assert.equal(saved!.invPricing.recommendation.Y.minPrice, 51);
    assert.deepEqual(saved!.invPricing.recommendation.Y.steps, []);
    assert.equal(saved!.invPricing.recommendation.Y.maxPrice, 200);
    assert.equal(saved!.invPricing.recommendation.C.steps.length, 7);
    assert.deepEqual(saved!.extensionSetting, { enabled: false });
    b.install();
    assert.deepEqual(b.saved.settings, saved);
});

test('installation recovers missing or malformed settings containers', () => {
    for (const value of [undefined, null, [], 'broken', 3]) {
        const b = background(value);
        b.install();
        assert.equal(b.saved.settings!.general.defaultDashboard, 'general');
        assert.equal(b.saved.settings!.invPricing.recommendation.Cargo.minPrice, 60);
    }
    const b = background({ invPricing: { recommendation: [] } });
    b.install();
    assert.equal(b.saved.settings!.invPricing.recommendation.F.maxPrice, 200);
});


test('options entry accepts only top-level game settings pages',async()=>{
    const b=background({});
    const valid={id:'aes-test',frameId:0,tab:{id:1},url:'https://paine.airlinesim.aero/app/enterprise/settings?2'};
    for(const sender of [{...valid,id:'other'},{...valid,frameId:1},{...valid,url:'https://example.com/app/enterprise/settings'},{...valid,url:'https://paine.airlinesim.aero/app/fleets'}]){
        assert.deepEqual(b.message({type:'AES_OPEN_OPTIONS'},sender).response,{ok:false});
    }
    assert.equal(b.opened.length,0);
    assert.equal(b.message({type:'AES_OPEN_OPTIONS'},valid).pending,true);
    await Promise.resolve();assert.deepEqual(b.opened,[{options:true}]);
});
