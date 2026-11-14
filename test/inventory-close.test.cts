import type { VMValue } from './support/fixtures.cts';
const {test}=(require('node:test') as typeof import('node:test'));
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const {runInNewContext}=(require('node:vm') as typeof import('node:vm'));
const {readFileSync}=(require('node:fs') as typeof import('node:fs'));
const source=readFileSync(`${__dirname}/../build/extension/modules/inventory-close.js`,'utf8');
const url='https://paine.airlinesim.aero/app/com/inventory/AAABBB';
function setup({enabled=1,tabUrl=url,pendingUrl,confirmed=true,closeError}: {enabled?: number | boolean | string; tabUrl?: string; pendingUrl?: string; confirmed?: boolean; closeError?: string}={}){
    let listener: (arg0: { type: string; token: string; tabId: number; },arg1: { id: string; frameId: number; documentId?: string; tab: { id: number; }; url?: string; },arg2: (value: unknown) => void) => void;const removed: VMValue[]=[],checks: VMValue[]=[];
    runInNewContext(source,{chrome:{
        runtime:{id:'aes',onMessage:{addListener:(fn: (arg0: { type: string; token: string; tabId: number; },arg1: { id: string; frameId: number; documentId?: string; tab: { id: number; }; url?: string; },arg2: (value: unknown) => void) => void)=>listener=fn}},
        storage:{local:{get:async()=>({settings:{invPricing:{autoClose:enabled}}})}},
        tabs:{get:async()=>({url:tabUrl,pendingUrl}),sendMessage:async(...args: VMValue[])=>{checks.push(args);return{ok:confirmed}},remove:async (id: string)=>{if(closeError)throw new Error(closeError);removed.push(id)}}
    }});
    return{removed,checks,send:(sender: {id: string; frameId: number; documentId?: string; tab: {id: number}; url?: string}={id:'aes',frameId:0,documentId:'doc',tab:{id:9},url})=>new Promise<import('./support/fixtures.cts').VMValue>(resolve=>listener({type:'AES_CLOSE_INVENTORY',token:'verified',tabId:99},sender,resolve))};
}
test('inventory close targets only the sender tab and confirms its source document',async()=>{
    const p=setup();assert.equal((await p.send()).ok,true);assert.deepEqual(p.removed,[9]);
    assert.equal(p.checks[0][2].documentId,'doc');assert.equal(p.checks[0][1].token,'verified');
});
test('inventory close rejects disabled settings, navigation, stale documents and invalid senders',async()=>{
    for(const options of [{enabled:0},{tabUrl:url+'/other'},{pendingUrl:url+'/other'},{confirmed:false}]){
        const p=setup(options);assert.equal((await p.send()).ok,false);assert.deepEqual(p.removed,[]);
    }
    for(const override of [{id:'other'},{frameId:1},{documentId:undefined},{url:'https://paine.airlinesim.aero/app/enterprise/dashboard'}]){
        const p=setup();assert.equal((await p.send({id:'aes',frameId:0,documentId:'doc',tab:{id:9},url,...override})).ok,false);assert.deepEqual(p.removed,[]);
    }
});
test('inventory close accepts legacy string settings without treating disabled strings as enabled',async()=>{
    for(const enabled of [1,true,'1']){
        const p=setup({enabled});assert.equal((await p.send()).ok,true);assert.deepEqual(p.removed,[9]);
    }
    for(const enabled of [0,false,'0','false']){
        const p=setup({enabled});assert.equal((await p.send()).reason,'disabled');assert.deepEqual(p.removed,[]);
    }
});
test('inventory close distinguishes page changes from Chrome failures',async()=>{
    const stale=setup({confirmed:false});assert.equal((await stale.send()).reason,'page-changed');
    const failed=setup({closeError:'Tab strip is locked'});assert.equal((await failed.send()).error,'Error: Tab strip is locked');assert.deepEqual(failed.removed,[]);
});
