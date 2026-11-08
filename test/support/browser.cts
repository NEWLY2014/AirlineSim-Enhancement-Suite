import type { Cleanup,FixtureData,Reply,StorageCall,VMValue } from './fixtures.cts';
const { readFileSync } = (require('node:fs') as typeof import('node:fs'));
const { join } = (require('node:path') as typeof import('node:path'));
const { runInContext } = (require('node:vm') as typeof import('node:vm'));
const { JSDOM } = (require('jsdom') as typeof import('jsdom'));
const {coordinator, sender} = (require('./coordinator.cts') as import('./coordinator.cts').API);
const snapshot = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
const source = (file: string) => readFileSync(join(__dirname, '../../build/extension', file), 'utf8');

function browser(t: Cleanup, { html = '', path = '/app/info/ors', data = {}, helpers = true }: {html?: string; path?: string; data?: FixtureData; helpers?: boolean} = {}) {
    const dom = new JSDOM(html, { url: `https://paine.airlinesim.aero${path}`, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window as unknown as import('./fixtures.cts').TestWindow;
    w.structuredClone = structuredClone;
    w.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
    w.HTMLDialogElement.prototype.close = function() { this.open = false; this.dispatchEvent(new w.Event("close")); };
    w.Worker = class {
        scope: {onmessage?: (event: {data: unknown}) => void; postMessage?: (data: unknown) => void};
        onmessage?: (event: {data: unknown}) => void;
        constructor(){const scope: typeof this.scope={};(require('node:vm') as typeof import('node:vm')).runInNewContext(source('modules/json-worker.js'),{globalThis:scope,Blob});this.scope=scope;scope.postMessage=(data: unknown)=>queueMicrotask(()=>this.onmessage?.({data}));}
        postMessage(data: unknown){queueMicrotask(()=>this.scope.onmessage!({data}));}
        terminate(){}
    };
    const saved: FixtureData = snapshot(data);
    const calls: StorageCall[] = [];
    const failures: Partial<Record<'get' | 'set' | 'clear' | 'remove', string>> = {};
    const errors: unknown[][] = [];
    w.console.error = (...args: unknown[]) => errors.push(args);
    const complete = (operation: keyof typeof failures, callback?: Reply, value?: unknown) => {
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
            async getKeys() {return Object.keys(saved);},
            async getBytesInUse(keys) {return Object.entries(saved).filter(([key])=>keys===null || key===keys || Array.isArray(keys)&&keys.includes(key)).reduce((n,[key,value])=>n+Buffer.byteLength(key+JSON.stringify(value)),0);},
            get(keys, callback) {
                let values: FixtureData = keys === null ? snapshot(saved) : {};
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
    const queueJobs = new Map<string, VMValue>();
    const dispatch = coordinator(w.chrome);
    const pageSender = sender(w.location.href);
    w.chrome.runtime.sendMessage = (message, callback) => {
        if (dispatch(message, pageSender, callback)) return;
        if (message.op === 'enqueue') {
            queueJobs.set(message.id, message);
            if (message.kind !== 'price' && message.kind !== 'read' && message.kind !== 'salary') w.open(message.url, message.kind === 'navigate' ? '_self' : '_blank');
        }
        callback({ok:true,state:'running',expires:Date.now()+10000});
    };
    const run = (code: string) => runInContext(code, dom.getInternalVMContext());
    const load = (file: string) => run(source(file));
    load('js/vendor/jquery-4.0.0.min.js');
    if (helpers) {load('helpers.js');load('modules/read-only.js');}
    t.after(() => {
        if (helpers) run('AES._ownershipLostCallbacks.forEach(fn => fn()); AES._pageControlObserver?.disconnect();');
        w.close();
    });
    return { w, run, load, saved, calls, failures, errors, dispatch, sender:pageSender };
}
async function until(check: () => unknown) {
    for (let i = 0; i < 100; i++) {
        if (check()) return;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('Expected browser state was not reached');
}
const api = { browser, until, snapshot, source };

export type API = typeof api;
module.exports = api;
