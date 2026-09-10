const {runInNewContext} = require('node:vm');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {webcrypto} = require('node:crypto');
let nextTab = 1;
function coordinator(chrome, {session = {}, liveTabs = null} = {}) {
    const listeners = [];
    const workerChrome = {
        runtime: {id:chrome.runtime.id, get lastError() {return chrome.runtime.lastError;}, onMessage:{addListener:fn=>listeners.push(fn)}},
        storage: {get local() {return chrome.storage.local;}, session:{
            async get(key) {return {[key]:session[key]};},
            async set(values) {Object.assign(session, structuredClone(values));},
            async remove(key) {delete session[key];}
        }},
        tabs: {async get(id) {if (liveTabs && !liveTabs.has(id)) throw new Error('Tab closed'); return {id};}}
    };
    runInNewContext(readFileSync(join(__dirname,'../../build/extension/modules/storage-coordinator.js'),'utf8'), {chrome:workerChrome,URL,crypto:webcrypto});
    return (message,sender,reply) => listeners[0](message,sender,reply);
}
function sender(url) {return {id:'aes-test',frameId:0,tab:{id:nextTab++},documentId:webcrypto.randomUUID(),url};}
module.exports={coordinator,sender};
