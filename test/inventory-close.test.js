const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runInNewContext}=require('node:vm');
const {readFileSync}=require('node:fs');
const source=readFileSync(`${__dirname}/../build/extension/modules/inventory-close.js`,'utf8');
const url='https://paine.airlinesim.aero/app/com/inventory/AAABBB';
function setup({enabled=1,tabUrl=url,pendingUrl,confirmed=true}={}){
    let listener;const removed=[],checks=[];
    runInNewContext(source,{chrome:{
        runtime:{id:'aes',onMessage:{addListener:fn=>listener=fn}},
        storage:{local:{get:async()=>({settings:{invPricing:{autoClose:enabled}}})}},
        tabs:{get:async()=>({url:tabUrl,pendingUrl}),sendMessage:async(...args)=>{checks.push(args);return{ok:confirmed}},remove:async id=>removed.push(id)}
    }});
    return{removed,checks,send:(sender={id:'aes',frameId:0,documentId:'doc',tab:{id:9},url})=>new Promise(resolve=>listener({type:'AES_CLOSE_INVENTORY',token:'verified',tabId:99},sender,resolve))};
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
