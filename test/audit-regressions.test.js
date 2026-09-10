// Regression coverage for the 2026-09-09 audit findings.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {browser, until, source} = require('./support/browser.cjs');
const header = `<script>window.frontendSettings = {"fixedEnterpriseId":42,"server":{"time":"2026-09-08T00:00:00Z"}};</script><div id="header"><div><button aria-haspopup="menu"><span class="_name_test">AES Airlines</span></button><div role="menubar"></div></div></div>`;
const btn = (p, text) => [...p.w.document.querySelectorAll('button')].find(b => b.textContent === text);
async function dash(t, tab, data) {
    const p = browser(t, {path:'/app/enterprise/dashboard',html:header+'<div id="enterprise-dashboard"></div>',data:{settings:{general:{defaultDashboard:tab}},...data}});
    p.load('content_dashboard.js');
    await until(() => p.w.document.querySelector('#aes-dashboard-root'));
    return p;
}
async function options(t, data) {
    const p = browser(t, {html:source('options.html'), helpers:false, data});
    p.downloads=[];p.w.Blob=Blob;
    p.w.URL.createObjectURL=blob => {p.downloads.push(blob);return 'blob:audit';};
    p.w.URL.revokeObjectURL=()=>{};p.w.HTMLAnchorElement.prototype.click=()=>{};
    p.load('options.js');await until(()=>p.w.document.querySelector('#aes-log-file-select').options.length);
    return p;
}
test('F01: competitor text remains literal in dashboard', async t => {
    const key='paine42_99competitorMonitoring';
    const p=await dash(t,'competitorMonitoring',{paine42competitorMonitoringIndex:['99'],[key]:{key,type:'competitorMonitoring',server:'paine',ownerId:'42',id:'99',tracking:1,tab0:{20260908:{id:'99',displayName:'<img id="audit-injected" src="invalid" onerror="window.auditInjected=1">'}},tab2:{}}});
    await until(()=>p.w.document.querySelector('#aes-compMon-row-99'));
    assert.equal(p.w.document.querySelector('#audit-injected'),null);
    assert.match(p.w.document.querySelector('#aes-compMon-row-99').textContent, /<img/);
});
test('F01: pricing step name remains an input value', async t => {
    const p=browser(t,{path:'/app/enterprise/settings',html:header+'<div class="bootstrap container-fluid"></div>',data:{settings:{invPricing:{recommendation:{Y:{minPrice:60,maxPrice:200,steps:[{min:0,max:100,step:1,name:'"><img id="audit-setting-injected" src="invalid">'}]}}}}}});
    p.load('content_settings.js');await until(()=>p.w.document.querySelector('#aes-settings-root'));
    assert.equal(p.w.document.querySelector('#audit-setting-injected'),null);
    assert.match(p.w.document.querySelector('#aes-table-invPricing input').value, /<img/);
});
test('F04: legacy migration preserves existing owner history', async t => {
    const oldKey='paine99competitorMonitoring',key='paine42_99competitorMonitoring';
    const common={type:'competitorMonitoring',server:'paine',id:'99',tracking:1,tab2:{}};
    const p=await dash(t,'competitorMonitoring',{[oldKey]:{...common,key:oldKey,tab0:{20260901:{displayName:'Old'}}},[key]:{...common,key,ownerId:'42',tab0:{20260908:{displayName:'New'}},newMetadata:'keep'}});
    await until(()=>!p.saved[oldKey]);
    assert.equal(p.saved[key].tab0['20260908'].displayName,'New');
    assert.equal(p.saved[key].tab0['20260901'].displayName,'Old');
    assert.equal(p.saved[key].newMetadata,'keep');
});
test('F05: Pricing Data backup includes actual routeAnalysis records', async t => {
    const p=await options(t,{paine42AAABBBrouteAnalysis:{type:'routeAnalysis',date:{20260908:{data:{}}}}});
    p.w.document.querySelector('#aes-backup-type').value='pricing';p.w.document.querySelector('#aes-backup-btn').click();
    const backup=JSON.parse(await p.downloads[0].text());assert.equal(backup.metadata.itemCount,1);
    assert.deepEqual(backup.data,p.saved);
});
test('F06: replace restore write failure retains previous data', async t => {
    const p=await options(t,{important:{history:[1,2,3]}});p.failures.set='Simulated write failure';
    const input=p.w.document.querySelector('#aes-restore-file');
    Object.defineProperty(input,'files',{value:[new p.w.File([JSON.stringify({metadata:{},data:{replacement:1}})],'backup.json')]});
    p.w.document.querySelector('#aes-restore-mode').value='replace';p.run('restoreData()');
    await until(()=>p.w.document.querySelector('#aes-status-message').classList.contains('status-error'));assert.deepEqual(p.saved,{important:{history:[1,2,3]}});
});


test('F10: settings helper stops on read failure', t => {
    const p=browser(t,{data:{settings:{important:'keep'}}});
    p.w.chrome.storage.local.get=(keys,callback)=>{
        p.w.chrome.runtime.lastError={message:'Read failed'};
        callback({});delete p.w.chrome.runtime.lastError;
    };
    p.run('AES.updateSettings(s=>s.newPreference=1,()=>window.auditReportedSuccess=true)');
    assert.deepEqual(p.saved.settings,{important:'keep'});assert.equal(p.w.auditReportedSuccess,undefined);
    assert.equal(p.calls.length,0);
});


const entry={flightCode:'AA 100',flightNumberValue:'10',flightNumberToken:'100',selectedDays:[6],daySettings:{6:{segments:{0:{arrival:{hours:'9',minutes:'30'}}}}}};
const jobKey='paine42flightPlanSchedulingJob';
const template={type:'aircraftFlightPlanTemplate',schemaVersion:6,sourceAircraftId:'9',sourceModel:'A320',sourceRegistration:'SOURCE',flights:[entry]};
async function planner(t,id='123',arrival='8') {
    const form=`<form><select name="existingNumber:numbers:numbers_body:input"><option value="10">AA 100</option></select>${Array.from({length:7},(_,i)=>`<input type="checkbox" name="days:daySelection:${i}:ticked"><select name="segmentsContainer:segments:0:newArrivals:${i}:newArrival:hours"><option value="${arrival}">${arrival}</option></select><select name="segmentsContainer:segments:0:newArrivals:${i}:newArrival:minutes"><option value="30">30</option></select>`).join('')}<input type="submit" name="button-submit"></form>`;
    const p=browser(t,{path:`/app/fleets/aircraft/${id}/0`,html:header+`<h1>Aircraft: AA-${id} / A320</h1><h3>Assign a new flight</h3><div class="as-panel">${form}</div><div class="visual-flight-plan"></div>`,data:{paine42flightPlanTemplate:template}});
    p.submissions=0;p.w.document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();p.submissions++;});
    p.load('content_aircraftFlightPlan.js');await until(()=>p.w.document.querySelector('#aes-aircraft-flight-plan-panel'));return p;
}
test('F02: unavailable template arrival hour prevents submission', async t => {
    const p=await planner(t);btn(p,'Start scheduling').click();await until(()=>p.saved[jobKey]?.status==='error');
    assert.equal(p.submissions,0);
    assert.equal(p.w.document.querySelector('select[name="segmentsContainer:segments:0:newArrivals:0:newArrival:hours"]').value,'8');
});
test('F03: second already-open aircraft page cannot replace an active job', async t => {
    const p=await planner(t,'123','9'),q=await planner(t,'456','9');
    // Both pages have already loaded an empty job snapshot. Share storage from now on.
    q.w.chrome.storage.local=p.w.chrome.storage.local;
    q.w.chrome.runtime.sendMessage=(message,reply)=>p.dispatch(message,q.sender,reply);
    btn(p,'Start scheduling').click();await until(()=>p.submissions);
    btn(q,'Start scheduling').click();await until(()=>q.errors.length);
    assert.equal(p.saved[jobKey].targetAircraftId,'123');assert.equal(p.submissions,1);assert.equal(q.submissions,0);
});

test('F06: failed replacement after journaling can recover across page reload', async t => {
    const original={settings:{important:'original'},history:[1,2,3]};
    const p=await options(t,original);
    p.failures.remove='Delete failed';
    p.w.target={settings:{important:'replacement'}};
    await p.run('replaceStorageData(window.target)');
    assert.deepEqual(p.saved.aesRestoreRecoveryV1.previous,original);
    assert.deepEqual(p.saved.settings,{important:'replacement'});
    const q=await options(t,p.saved);
    btn(q,'Recover data from before restore').click();
    await until(()=>!q.saved.aesRestoreRecoveryV1);
    assert.deepEqual(q.saved,original);
});

test('F06: interrupted restore copy is retained if recovery writes fail', async t => {
    const original={settings:{a:1}};
    const p=await options(t,{settings:{a:2},aesRestoreRecoveryV1:{previous:original}});
    p.failures.set='Disk unavailable';
    btn(p,'Recover data from before restore').click();
    await until(()=>p.w.document.querySelector('#aes-status-message').classList.contains('status-error'));
    assert.deepEqual(p.saved.aesRestoreRecoveryV1.previous,original);
    assert.deepEqual(p.saved.settings,{a:2});
});

test('F10: failed settings write neither reports success nor changes preferences', t => {
    const p=browser(t,{data:{settings:{a:1}}});p.failures.set='Write unavailable';
    p.run('AES.updateSettings(s=>s.a=2,()=>window.success=true)');
    assert.equal(p.w.success,undefined);assert.deepEqual(p.saved.settings,{a:1});assert.ok(p.errors.length);
});

test('F02: final validation catches arrival controls removed while saving', async t => {
    const p=await planner(t,'123','9');const originalSet=p.w.chrome.storage.local.set;
    p.w.chrome.storage.local.set=(values,callback)=>{
        if(values[jobKey]?.status==='waitForApply')p.w.document.querySelector('select[name="segmentsContainer:segments:0:newArrivals:0:newArrival:hours"]').remove();
        return originalSet(values,callback);
    };
    btn(p,'Start scheduling').click();await until(()=>p.saved[jobKey]?.status==='error');
    assert.equal(p.submissions,0);
});

test('F01: custom column titles and Inventory links use explicit DOM construction', async t => {
    const p=await dash(t,'routeManagement',{
        settings:{general:{defaultDashboard:'routeManagement'},routeManagement:{tableColumns:[
            {class:'aes-link',name:'<img id="column-injection">',value:'actionInventory',show:1}
        ]}},
        paine42schedule:{type:'schedule',date:{20260908:{schedule:[{origin:'AAA',destination:'BBB',od:'AAABBB',flightNumber:{1:{paxFreq:7}}}]}}}
    });
    await until(()=>p.w.document.querySelector('#aes-row-AAABBB'));
    assert.equal(p.w.document.querySelector('#column-injection'),null);
    assert.equal(p.w.document.querySelector('#aes-row-AAABBB a').getAttribute('href'),'/app/com/inventory/AAABBB');
});
