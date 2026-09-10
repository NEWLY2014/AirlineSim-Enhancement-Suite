const {runInNewContext} = require('node:vm');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {webcrypto} = require('node:crypto');
let nextTab = 1;
const contentListeners = new WeakMap();
function coordinator(chrome, {session = {}, liveTabs = null} = {}) {
    const listeners = [];
    if (!contentListeners.has(chrome.runtime)) {
        contentListeners.set(chrome.runtime, []);
        chrome.runtime.onMessage = {addListener:fn=>contentListeners.get(chrome.runtime).push(fn)};
    }
    const workerChrome = {
        runtime: {id:chrome.runtime.id, get lastError() {return chrome.runtime.lastError;}, onMessage:{addListener:fn=>listeners.push(fn)}},
        storage: {get local() {return chrome.storage.local;}, session:{
            async get(key) {return {[key]:session[key]};},
            async set(values) {Object.assign(session, structuredClone(values));},
            async remove(key) {delete session[key];}
        }},
        tabs: {
            async get(id) {if (liveTabs && !liveTabs.has(id)) throw new Error('Tab closed'); return {id};},
            async sendMessage(id, message) {
                let response;
                for (const listener of contentListeners.get(chrome.runtime)) listener(message,{id:chrome.runtime.id},value=>{response=value;});
                if (!response) throw new Error('No receiving page');
                return response;
            }
        }
    };
    for (const file of ['storage-coordinator.js','schedule-storage.js']) {
        runInNewContext(readFileSync(join(__dirname,'../../build/extension/modules/'+file),'utf8'), {chrome:workerChrome,URL,crypto:webcrypto});
    }
    return (message,sender,reply) => {
        let answered = false;
        for (const listener of listeners) {
            if (listener(message,sender,value=>{answered=true;reply(value);}) || answered) return true;
        }
        return false;
    };
}
function sender(url) {return {id:'aes-test',frameId:0,tab:{id:nextTab++},documentId:webcrypto.randomUUID(),url};}
module.exports={coordinator,sender};
