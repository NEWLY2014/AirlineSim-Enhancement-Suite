const {test} = require('node:test');
const assert = require('node:assert/strict');
const {browser,until} = require('./support/browser.cjs');
const cabins = ['Y','C','F','Cargo'];
const key = 'paine42AAABBBrouteAnalysis';
const header = `<script>window.frontendSettings = {"fixedEnterpriseId":42,"server":{"time":"2026-09-08T00:00:00Z"}};</script><div id="header"><div><button aria-haspopup="menu"><span class="_name_test">AES Airlines</span></button><div role="menubar"></div></div></div>`;
function settings(extra={}) { return {invPricing:{autoAnalysisSave:0,autoPriceUpdate:0,autoClose:0,showReferenceRecommendation:1,historyTable:{showNow:1,showOnlyPricing:0,numberOfDates:'5'},recommendation:Object.fromEntries(cabins.map(c => [c,{minPrice:60,maxPrice:200,steps:[{min:0,max:69,name:'Lower',step:-10},{min:70,max:100,name:'Raise',step:10}]}])),...extra}}; }
function row(c='Y', price=100, booked=80,status='finished') {return `<tr><td></td><td><a href="numbers/1">AA 100</a></td><td>08.09.</td><td></td><td></td><td>${c}</td><td>100</td><td>${booked}</td><td></td><td>${price}</td><td>${status}</td></tr>`;}
function inventory(t,{rows=row(),current=100,data={},grouped=false}={}) {
    const prices = `<form class="pricing"><table><tbody>${cabins.map(c => `<tr><td>${c}</td><td>${current}</td><td><input value="${current}"></td><td></td><td>100</td></tr>`).join('')}</tbody></table><button name="submit-prices">Submit</button></form>`;
    const validation = '<ul><li class="active">All Flight Numbers</li></ul><div><div><div><fieldset></fieldset><fieldset></fieldset><fieldset><div><input type="checkbox" checked><input type="checkbox" checked><input type="checkbox"><input type="checkbox"></div></fieldset></div></div></div>';
    const p = browser(t,{data:{settings:settings(),...data},html:header+`<h1>Inventory</h1><h2><a>AAA</a><a>BBB</a></h2><div class="container-fluid"><div class="row"><div class="col-md-10"><div><div class="as-panel">${prices}</div><div class="as-panel">${validation}</div><table id="${grouped?'inventory-grouped-table':'inventory-table'}"><tbody>${rows}</tbody></table></div></div></div></div>`});
    Object.defineProperty(p.w.HTMLElement.prototype,'innerText',{get(){return this.textContent;},set(v){this.textContent=v;},configurable:true});
    // Resolve the controlled airline without relying on unrelated enterprise-page markup.
    p.run('AES.getAirline = AES.getCurrentAirline');
    p.submissions=[];p.closed=0;p.w.close = (() => { const close=p.w.close.bind(p.w); t.after(close); return () => {p.closed++;};})();
    p.w.document.querySelector('form').addEventListener('submit',event=>{event.preventDefault();p.submissions.push(p.saved[key] === undefined ? undefined : JSON.parse(JSON.stringify(p.saved[key])));});
    const get = p.w.chrome.storage.local.get;
    p.w.chrome.storage.local.get = (keys,callback) => callback ? get(keys,callback) : new Promise(resolve=>setTimeout(resolve,10)).then(()=>get(keys));
    p.load('modules/inventory/validation.js');
    return p;
}
async function load(p) {p.load('content_inventory.js');await until(()=>p.w.document.querySelector('#aes-table-analysis tbody tr'));}
const click = (p,id) => p.w.document.querySelector(id).click();

test('inventory computes current-price recommendations and saves a snapshot',async t=>{
    const p=inventory(t);await load(p);
    assert.equal(p.w.document.querySelector('.pricing input').value,'110');
    click(p,'#aes-btn-invPricing-save-snapshot');
    await until(()=>p.saved[key]);
    const y=p.saved[key].date['20260908'].data.Y;
    assert.equal(y.totalBkd,80);assert.equal(y.totalCap,100);assert.equal(y.index,80);assert.equal(y.newPrice,110);
    assert.equal(p.saved[key].date['20260908'].pricingUpdated,0);
});

test('inventory clamps recommendations to bounds even without completed flights',async t=>{
    const p=inventory(t,{current:250,rows:row('Y',250,80,'scheduled')});await load(p);
    assert.equal(p.w.document.querySelector('.pricing input').value,'200');
    assert.match(p.w.document.querySelector('#aes-table-analysis').textContent,/Drop to maximum/);
});

test('old active prices generate reference-only recommendations',async t=>{
    const p=inventory(t,{current:120});await load(p);
    assert.equal(p.w.document.querySelector('.pricing input').value,'120');
    assert.equal(p.w.document.querySelector('#aes-btn-invPricing-apply-new-prices'),null);
    click(p,'#aes-btn-invPricing-apply-reference-prices');
    await until(()=>p.submissions.length);
    assert.equal(p.w.document.querySelector('.pricing input').value,'110');
    assert.deepEqual(p.submissions[0].date['20260908'].pricingUpdatePending.targetPrices,{Y:110});
});

test('pending updates are persisted before submit and confirmed only at matching current prices',async t=>{
    const p=inventory(t);await load(p);click(p,'#aes-btn-invPricing-apply-new-prices');await until(()=>p.submissions.length);
    const saved=p.submissions[0];assert.equal(saved.date['20260908'].pricingUpdated,0);
    const q=inventory(t,{current:110,data:{[key]:saved}});await load(q);
    assert.equal(q.saved[key].date['20260908'].pricingUpdated,1);
    assert.equal(q.saved[key].date['20260908'].pricingUpdatePending,undefined);
    assert.equal(q.submissions.length,0);
});

test('grouped inventory shares flight metadata across cabin rows',async t=>{
    const p=inventory(t,{grouped:true,rows:row()+'<tr><td>C</td><td>20</td><td>10</td><td></td><td>100</td></tr>'});await load(p);
    click(p,'#aes-btn-invPricing-save-snapshot');await until(()=>p.saved[key]);
    assert.equal(p.saved[key].date['20260908'].data.C.totalCap,20);
    assert.equal(p.saved[key].date['20260908'].data.C.newPrice,90);
});

test('failed snapshot writes retain history, show failure, and permit retry without closing',async t=>{
    const original={key,date:{'20260901':{extra:'keep'}},extra:'root'};
    const p=inventory(t,{data:{[key]:original,settings:settings({autoClose:1})}});await load(p);
    p.failures.set='Write failed';click(p,'#aes-btn-invPricing-save-snapshot');
    await until(()=>/Unable to save/.test(p.w.document.querySelector('#aes-div-analysis').textContent));
    assert.deepEqual(p.saved[key],original);assert.equal(p.closed,0);
    assert.equal(p.w.document.querySelector('#aes-btn-invPricing-save-snapshot').disabled,false);
    delete p.failures.set;click(p,'#aes-btn-invPricing-save-snapshot');await until(()=>p.closed===1);
    assert.deepEqual(p.saved[key].date['20260901'],{extra:'keep'});assert.equal(p.saved[key].extra,'root');assert.equal(p.closed,1);
    assert.ok(!('getLoad' in p.calls.findLast(c=>c.values?.[key]).values[key].date['20260908']));
});

test('failed pending writes never submit and retry succeeds',async t=>{
    const p=inventory(t);await load(p);p.failures.set='Write failed';click(p,'#aes-btn-invPricing-apply-new-prices');
    await until(()=>/Unable to save/.test(p.w.document.querySelector('#aes-div-analysis').textContent));
    assert.equal(p.submissions.length,0);assert.equal(p.saved[key],undefined);
    delete p.failures.set;click(p,'#aes-btn-invPricing-apply-new-prices');await until(()=>p.submissions.length);
    assert.equal(p.submissions.length,1);
});

test('unconfirmed pending prices suppress automatic resubmission and survive snapshot saving',async t=>{
    const p=inventory(t);await load(p);click(p,'#aes-btn-invPricing-apply-new-prices');await until(()=>p.submissions.length);
    const saved=p.submissions[0];
    const q=inventory(t,{data:{[key]:saved,settings:settings({autoPriceUpdate:1})}});await load(q);
    assert.equal(q.submissions.length,0);
    click(q,'#aes-btn-invPricing-save-snapshot');await until(()=>q.w.document.querySelector('#aes-div-analysis').textContent.includes('Data Saved!'));
    assert.deepEqual(q.saved[key].date['20260908'].pricingUpdatePending.targetPrices,{Y:110});
});

test('history ignores malformed dates and retains unknown records while saving',async t=>{
    const item={valid:1,totalCap:100,totalBkd:50,analysisPrice:90,analysisPricePoint:90,index:40};
    const history={'20260901':{data:{Y:item},extra:'keep'},'20260902':null,'2026bad':{data:{Y:item}},notes:{custom:true}};
    const p=inventory(t,{data:{[key]:{key,date:history}}});await load(p);
    assert.ok(p.w.document.querySelector('#aes-table-inventory-history'));
    assert.doesNotMatch(p.w.document.querySelector('#aes-table-inventory-history').textContent,/NaN|undefined/);
    click(p,'#aes-btn-invPricing-save-snapshot');await until(()=>p.saved[key].date['20260908']);
    for(const [date,value] of Object.entries(history)) assert.deepEqual(p.saved[key].date[date],value);
});

test('native table replacement with unchanged row counts refreshes analysis',async t=>{
    const p=inventory(t);await load(p);
    p.w.document.querySelector('#inventory-table tbody').innerHTML=row('Y',100,50);
    await until(()=>p.w.document.querySelector('.pricing input').value==='90');
    click(p,'#aes-btn-invPricing-save-snapshot');await until(()=>p.saved[key]);
    assert.equal(p.saved[key].date['20260908'].data.Y.totalBkd,50);
});

test('loss of ownership during pending persistence prevents form submission',async t=>{
    const p=inventory(t);await load(p);
    const original=p.w.chrome.storage.local.set;let finish;
    p.w.chrome.storage.local.set=(values,callback)=>values[key]?new Promise(resolve=>{finish=()=>{original(values);resolve();};}):original(values,callback);
    click(p,'#aes-btn-invPricing-apply-new-prices');await until(()=>finish);
    p.run('AES.isPageOwner=()=>false; AES._ownershipLostCallbacks.forEach(fn=>fn());');finish();
    await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal(p.submissions.length,0);assert.equal(p.w.document.querySelector('#aes-div-analysis'),null);
});

test('invalid pricing configuration and incomplete flight rows do not submit or save',async t=>{
    const config=settings({autoPriceUpdate:1});config.invPricing.recommendation.Y.minPrice=300;
    const p=inventory(t,{data:{settings:config}});p.load('content_inventory.js');await until(()=>p.errors.length);
    assert.equal(p.saved[key],undefined);assert.equal(p.submissions.length,0);
    const q=inventory(t,{rows:'<tr><td>Loading</td></tr>',data:{settings:settings({autoPriceUpdate:1})}});q.load('content_inventory.js');
    await new Promise(resolve=>setTimeout(resolve,80));
    assert.equal(q.saved[key],undefined);assert.equal(q.submissions.length,0);
});

test('automatic analysis saving and automatic price updates retain their distinct behavior',async t=>{
    const p=inventory(t,{data:{settings:settings({autoAnalysisSave:1})}});await load(p);await until(()=>p.saved[key]);
    assert.equal(p.submissions.length,0);assert.equal(p.saved[key].date['20260908'].pricingUpdatePending,undefined);
    const q=inventory(t,{data:{settings:settings({autoPriceUpdate:1})}});await load(q);await until(()=>q.submissions.length);
    assert.deepEqual(q.submissions[0].date['20260908'].pricingUpdatePending.targetPrices,{Y:110});
});

test('failed confirmation preserves the pending marker and suppresses further automated submits',async t=>{
    const p=inventory(t);await load(p);click(p,'#aes-btn-invPricing-apply-new-prices');await until(()=>p.submissions.length);
    const q=inventory(t,{current:110,data:{[key]:p.submissions[0],settings:settings({autoPriceUpdate:1})}});
    q.failures.set='Cannot confirm';await load(q);
    assert.equal(q.saved[key].date['20260908'].pricingUpdated,0);
    assert.ok(q.saved[key].date['20260908'].pricingUpdatePending);
    assert.equal(q.submissions.length,0);
});

test('invalid edited prices block the entire submission and leave the action retryable',async t=>{
    const p=inventory(t);await load(p);p.w.document.querySelector('.pricing input').value='invalid';
    click(p,'#aes-btn-invPricing-apply-new-prices');
    await until(()=>p.w.document.querySelector('#aes-div-analysis').textContent.includes('Invalid target price'));
    assert.equal(p.submissions.length,0);assert.equal(p.saved[key],undefined);
    assert.equal(p.w.document.querySelector('#aes-btn-invPricing-apply-new-prices').disabled,false);
});

test('native pricing changes during a pending save invalidate the old submit action',async t=>{
    const p=inventory(t);await load(p);
    const original=p.w.chrome.storage.local.set;let finish;
    p.w.chrome.storage.local.set=(values,callback)=>values[key]?new Promise(resolve=>{finish=()=>{original(values);resolve();};}):original(values,callback);
    click(p,'#aes-btn-invPricing-apply-new-prices');await until(()=>finish);
    p.w.document.querySelector('.pricing tbody tr td:nth-child(2)').textContent='120';finish();
    await new Promise(resolve=>setTimeout(resolve,80));
    assert.equal(p.submissions.length,0);
    assert.ok(p.saved[key].date['20260908'].pricingUpdatePending);
});

test('zero minimum price remains compatible with the settings editor',async t=>{
    const config=settings();config.invPricing.recommendation.Y.minPrice=0;
    const p=inventory(t,{data:{settings:config}});await load(p);
    assert.equal(p.w.document.querySelector('.pricing input').value,'110');
    assert.equal(p.errors.length,0);
});

test('queued price update waits before saving or submitting and rejects changed inputs',async t=>{
    const p=inventory(t);await load(p);let grant;
    p.w.chrome.runtime.sendMessage=(message,callback)=>message.op==='poll'?(grant=callback):callback({ok:true,state:'queued'});
    click(p,'#aes-btn-invPricing-apply-new-prices');await until(()=>grant);
    assert.equal(p.submissions.length,0);assert.equal(p.saved[key],undefined);
    p.w.document.querySelector('.pricing input').value='115';grant({ok:true,state:'running',expires:Date.now()+10000});
    await until(()=>!p.w.document.querySelector('#aes-btn-invPricing-apply-new-prices').disabled);
    assert.equal(p.submissions.length,0);assert.equal(p.saved[key],undefined);
});
test('native price submit uses the same queue and ignores repeated clicks while waiting',async t=>{
    const p=inventory(t);await load(p);let grant;let enqueues=0;
    p.w.chrome.runtime.sendMessage=(message,callback)=>{
        if(message.op==='enqueue')enqueues++;
        if(message.op==='poll')grant=callback;else callback({ok:true,state:'queued'});
    };
    click(p,'.pricing [name="submit-prices"]');click(p,'.pricing [name="submit-prices"]');await until(()=>grant);
    assert.equal(enqueues,1);assert.equal(p.submissions.length,0);
    grant({ok:true,state:'running',expires:Date.now()+10000});await until(()=>p.submissions.length===1);
    assert.equal(p.saved[key],undefined);
});
test('queue failure never falls back to immediate price submission',async t=>{
    const p=inventory(t);await load(p);
    p.w.chrome.runtime.sendMessage=(message,callback)=>callback({ok:false,error:'Queue unavailable'});
    click(p,'#aes-btn-invPricing-apply-new-prices');await until(()=>/Queue unavailable/.test(p.w.document.body.textContent));
    assert.equal(p.submissions.length,0);assert.equal(p.saved[key],undefined);
});
test('an expired queue permit cannot submit prices',async t=>{
    const p=inventory(t);await load(p);
    p.w.chrome.runtime.sendMessage=(message,callback)=>callback({ok:true,state:'running',expires:Date.now()-1});
    click(p,'#aes-btn-invPricing-apply-new-prices');await until(()=>/expired/.test(p.w.document.body.textContent));
    assert.equal(p.submissions.length,0);assert.equal(p.saved[key],undefined);
});
