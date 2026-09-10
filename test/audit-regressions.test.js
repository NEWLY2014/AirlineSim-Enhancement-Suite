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








const entry={flightCode:'AA 100',flightNumberValue:'10',flightNumberToken:'100',selectedDays:[6],daySettings:{6:{segments:{0:{arrival:{hours:'9',minutes:'30'}}}}}};
const jobKey='paine42flightPlanSchedulingJob';
const template={type:'aircraftFlightPlanTemplate',schemaVersion:6,sourceAircraftId:'9',sourceModel:'A320',sourceRegistration:'SOURCE',flights:[entry]};
async function planner(t,id='123',arrival='8') {
    const form=`<form><select name="existingNumber:numbers:numbers_body:input"><option value="10">AA 100</option></select>${Array.from({length:7},(_,i)=>`<input type="checkbox" name="days:daySelection:${i}:ticked"><select name="segmentsContainer:segments:0:newArrivals:${i}:newArrival:hours"><option value="${arrival}">${arrival}</option></select><select name="segmentsContainer:segments:0:newArrivals:${i}:newArrival:minutes"><option value="30">30</option></select>`).join('')}<input type="submit" name="button-submit"></form>`;
    const p=browser(t,{path:`/app/fleets/aircraft/${id}/0`,html:header+`<h1>Aircraft: AA-${id} / A320</h1><h3>Assign a new flight</h3><div class="as-panel">${form}</div><div class="visual-flight-plan"></div>`,data:{paine42flightPlanTemplate:template}});
    p.submissions=0;p.w.document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();p.submissions++;});
    p.load('content_aircraftFlightPlan.js');await until(()=>p.w.document.querySelector('#aes-aircraft-flight-plan-panel'));return p;
}











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
