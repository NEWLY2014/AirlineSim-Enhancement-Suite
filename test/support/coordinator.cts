import type { FixtureData,Listener,MockChrome,Reply,VMValue } from './fixtures.cts';
const {runInNewContext, createContext, runInContext} = (require('node:vm') as typeof import('node:vm'));
const {readFileSync} = (require('node:fs') as typeof import('node:fs'));
const {join} = (require('node:path') as typeof import('node:path'));
const {webcrypto} = (require('node:crypto') as typeof import('node:crypto'));
let nextTab = 1;
const contentListeners = new WeakMap<MockChrome['runtime'], Listener[]>();
function coordinator(chrome: MockChrome, {session = {}, liveTabs = null}: {session?: FixtureData; liveTabs?: Set<number> | null} = {}) {
    const listeners: Listener[] = [];
    if (!contentListeners.has(chrome.runtime)) {
        contentListeners.set(chrome.runtime, []);
        chrome.runtime.onMessage = {
            addListener:(fn: Listener)=>contentListeners.get(chrome.runtime)!.push(fn),
            removeListener:(fn: Listener)=>{const list=contentListeners.get(chrome.runtime)!,i=list.indexOf(fn);if(i>=0)list.splice(i,1);}
        };
    }
    const workerChrome = {
        runtime: {id:chrome.runtime.id, get lastError() {return chrome.runtime.lastError;}, onMessage:{addListener:(fn: Listener)=>listeners.push(fn)}},
        storage: {get local() {return chrome.storage.local;}, session:{
            async get(key: string|number) {return {[key]:session[key]};},
            async set(values: FixtureData) {Object.assign(session, structuredClone(values));},
            async remove(key: string|number) {delete session[key];}
        }},
        tabs: {
            async get(id: number) {if (liveTabs && !liveTabs.has(id)) throw new Error('Tab closed'); return {id};},
            async sendMessage(id: number, message: VMValue) {
                let response: VMValue;
                for (const listener of contentListeners.get(chrome.runtime)!) listener(message,{id:chrome.runtime.id},value=>{response=value;});
                if (!response) throw new Error('No receiving page');
                return response;
            }
        }
    };
    const context = createContext({chrome:workerChrome,URL,crypto:webcrypto});
    for (const file of ['storage-coordinator.js','schedule-storage.js','options-summary.js']) {
        runInContext(readFileSync(join(__dirname,'../../build/extension/modules/'+file),'utf8'), context);
    }
    return (message: VMValue,sender: VMValue,reply: Reply) => {
        let answered = false;
        for (const listener of listeners) {
            if (listener(message,sender,value=>{answered=true;reply(value);}) || answered) return true;
        }
        return false;
    };
}
function sender(url: string) {return {id:'aes-test',frameId:0,tab:{id:nextTab++},documentId:webcrypto.randomUUID(),url};}
const api ={coordinator,sender,notify:(chrome: MockChrome,message: VMValue)=>{for(const fn of [...contentListeners.get(chrome.runtime)!])fn(message,{id:chrome.runtime.id},()=>{});}};

export type API = typeof api;
module.exports = api;
