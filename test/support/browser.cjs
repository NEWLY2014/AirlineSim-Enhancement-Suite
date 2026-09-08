const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInContext } = require('node:vm');
const { JSDOM } = require('jsdom');
const snapshot = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const source = file => readFileSync(join(__dirname, '../../build/extension', file), 'utf8');

function browser(t, { html = '', path = '/app/info/ors', data = {}, helpers = true } = {}) {
    const dom = new JSDOM(html, { url: `https://paine.airlinesim.aero${path}`, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    const saved = snapshot(data);
    const calls = [];
    const failures = {};
    const errors = [];
    w.console.error = (...args) => errors.push(args);
    const complete = (operation, callback, value) => {
        if (callback) {
            if (failures[operation]) w.chrome.runtime.lastError = { message: failures[operation] };
            try { callback(value); } finally { delete w.chrome.runtime.lastError; }
        } else return failures[operation] ? Promise.reject(new Error(failures[operation])) : Promise.resolve(value);
    };
    w.chrome = {
        runtime: {
            id: 'aes-test', getManifest: () => ({ version: '0.8.13', version_name: '0.8.13' }),
            getURL: path => `chrome-extension://aes-test/${path}`
        },
        storage: { local: {
            get(keys, callback) {
                let values = keys === null ? snapshot(saved) : {};
                for (const key of typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || {})) {
                    if (key in saved) values[key] = snapshot(saved[key]);
                    else if (keys && !Array.isArray(keys) && typeof keys === 'object') values[key] = snapshot(keys[key]);
                }
                return complete('get', callback, values);
            },
            set(values, callback) {
                calls.push({ operation: 'set', values: snapshot(values) });
                if (!failures.set) Object.assign(saved, snapshot(values));
                return complete('set', callback);
            },
            clear(callback) {
                calls.push({ operation: 'clear' });
                if (!failures.clear) for (const key of Object.keys(saved)) delete saved[key];
                return complete('clear', callback);
            },
            remove(keys, callback) {
                calls.push({ operation: 'remove', keys: snapshot(keys) });
                if (!failures.remove) for (const key of typeof keys === 'string' ? [keys] : keys) delete saved[key];
                return complete('remove', callback);
            }
        } }
    };
    const queueJobs = new Map();
    w.chrome.runtime.sendMessage = (message, callback) => {
        if (message.op === 'enqueue') {
            queueJobs.set(message.id, message);
            if (message.kind !== 'price') w.open(message.url, message.kind === 'navigate' ? '_self' : '_blank');
        }
        callback({ok:true,state:'running',expires:Date.now()+10000});
    };
    const run = code => runInContext(code, dom.getInternalVMContext());
    const load = file => run(source(file));
    load('js/vendor/jquery-4.0.0.min.js');
    if (helpers) load('helpers.js');
    t.after(() => {
        if (helpers) run('AES._ownershipLostCallbacks.forEach(fn => fn()); AES._pageControlObserver?.disconnect();');
        w.close();
    });
    return { w, run, load, saved, calls, failures, errors };
}
async function until(check) {
    for (let i = 0; i < 100; i++) {
        if (check()) return;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('Expected browser state was not reached');
}
module.exports = { browser, until, snapshot, source };
