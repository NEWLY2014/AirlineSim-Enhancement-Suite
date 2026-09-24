const {test} = require('node:test');
const assert = require('node:assert/strict');
const {browser,until} = require('./support/browser.cjs');
const header = `<script>window.frontendSettings = {"fixedEnterpriseId":42,"server":{"time":"2026-09-08T00:00:00Z"}};</script><div id="header"><div><button aria-haspopup="menu"><span class="_name_test">AES Airlines</span><span class="_code_test">AA</span></button><div role="menubar"></div></div></div>`;
const owner = {id:'42',name:'AES_Airlines',displayName:'AES Airlines',code:'AA'};
const route = {origin:'AAA',destination:'BBB',od:'AAABBB',direction:'Outbound',flightNumber:{100:{paxFreq:7,cargoFreq:2}}};
const schedule = (id='42') => ({type:'schedule',server:'paine',airline:{id},date:{'20260908':{schedule:[route]}}});
function dashboard(t,tab='general',data={}) {
    const p=browser(t,{html:header+'<div class="bootstrap container-fluid"><h1>Dashboard</h1><div id="enterprise-dashboard"></div></div>',path:'/app/enterprise/dashboard',data:{settings:{general:{defaultDashboard:tab},schedule:{},...data.settings},...data}});
    p.opened=[];p.w.open=(...args)=>{p.opened.push(args);return null;};return p;
}
async function load(p,selector='#aes-dashboard-root'){p.load('content_dashboard.js');await until(()=>p.w.document.querySelector(selector));}
const button=(p,text)=>[...p.w.document.querySelectorAll('#aes-dashboard-root button')].find(b=>b.textContent===text);

test('dashboard route totals and selected inventory action retain route identity',async t=>{
    const p=dashboard(t,'routeManagement',{paine42schedule:schedule()});await load(p,'#aes-table-routeManagement tbody tr');
    const row=p.w.document.querySelector('#aes-row-AAABBB');assert.equal(row.querySelector('.aes-paxFreq').textContent,'7');assert.equal(row.querySelector('.aes-totalFreq').textContent,'9');
    row.querySelector('input').click();button(p,'Open inventory (max 10)').click();
    assert.deepEqual(p.opened,[['https://paine.airlinesim.aero/app/com/inventory/AAABBB','_blank']]);
    await until(()=>!button(p,'Open inventory (max 10)').disabled);
});

test('aircraft dashboard footer averages visible rows and hide checked retains stored data',async t=>{
    const fleet={server:'paine',airline:owner,fleet:[{aircraftId:1,registration:'AA-1',age:2},{aircraftId:2,registration:'AA-2',age:4}]};
    const p=dashboard(t,'aircraftProfitability',{paine42aircraftFleet:fleet});await load(p,'#aircraft-id-1');
    const table=p.w.document.querySelector('#aircraft-id-1').closest('table');
    const index=[...table.tHead.rows[1].cells].findIndex(c=>c.textContent==='Age')+1;
    assert.equal(table.tFoot.rows[0].cells[index].textContent,'3');
    table.tBodies[0].rows[0].querySelector('input').click();button(p,'Hide checked').click();
    assert.equal(table.tBodies[0].rows.length,1);assert.equal(table.tFoot.rows[0].cells[index].textContent,'4');assert.deepEqual(p.saved.paine42aircraftFleet,fleet);
});

test('aircraft removal requires two clicks and retains other aircraft and metadata',async t=>{
    const p=dashboard(t,'aircraftProfitability',{paine42aircraftFleet:{extra:'keep',fleet:[{aircraftId:1,registration:'AA-1'},{aircraftId:2,registration:'AA-2'}]},paineaircraftFlights1:{aircraftId:1,profit:10}});await load(p,'#aircraft-id-1');
    p.w.document.querySelector('#aircraft-id-1 input').click();button(p,'Remove aircraft').click();assert.equal(p.saved.paine42aircraftFleet.fleet.length,2);
    button(p,'Confirm remove 1').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(p.saved.paine42aircraftFleet.fleet.length,1);assert.equal(p.saved.paine42aircraftFleet.extra,'keep');assert.equal(p.saved.paineaircraftFlights1,undefined);
});

test('competitor owner index loads overview and schedule totals',async t=>{
    const key='paine42_99competitorMonitoring';
    const p=dashboard(t,'competitorMonitoring',{paine42competitorMonitoringIndex:['99'],[key]:{key,type:'competitorMonitoring',server:'paine',ownerId:'42',id:'99',tracking:1,tab0:{'20260908':{id:'99',code:'OA',displayName:'Other Air',rating:'AAA',pax:100,fleet:2}},tab2:{}},paine99schedule:schedule('99')});
    await load(p,'#aes-compMon-row-99');const row=p.w.document.querySelector('#aes-compMon-row-99');assert.match(row.textContent,/Other Air/);row.querySelector('input').click();button(p,'Show airline schedule').click();
    await until(()=>p.w.document.querySelector('#aes-table-competitorMonitoring-airline-schedule'));assert.match(p.w.document.querySelector('#aes-table-competitorMonitoring-airline-schedule').textContent,/AAA/);
    button(p,'Back to overview').click();assert.equal(p.w.document.querySelector('#aes-compMonitor-schedule'),null);
});

test('switching airline scope clears filters and preserves unrelated settings',async t=>{
    const p=dashboard(t,'general',{settings:{general:{defaultDashboard:'general',dashboardFilterScopeKey:'paine:7'},routeManagement:{filter:[{value:'AAA'}]},aircraftProfitability:{filter:[{value:'A320'}]},extra:'keep'}});await load(p);
    assert.equal(p.saved.settings.general.dashboardFilterScopeKey,'paine:42');assert.deepEqual(p.saved.settings.routeManagement.filter,[]);assert.deepEqual(p.saved.settings.aircraftProfitability.filter,[]);assert.equal(p.saved.settings.extra,'keep');
});

test('route analysis joins both directions and shows load and route index',async t=>{
    const snapshot={data:{Y:{valid:1,totalCap:100,totalBkd:80,index:90}},pricingUpdated:1};
    const p=dashboard(t,'routeManagement',{paine42schedule:schedule(),paine42AAABBBrouteAnalysis:{origin:'AAA',destination:'BBB',date:{'20260908':snapshot}},paine42BBBAAArouteAnalysis:{origin:'BBB',destination:'AAA',date:{'20260908':{data:{Y:{valid:1,totalCap:100,totalBkd:60,index:70}}}}}});
    await load(p,'#aes-row-AAABBB .aes-routeIndex');
    assert.equal(p.w.document.querySelector('#aes-row-AAABBB .aes-paxLoad').textContent,'80%');
    assert.equal(p.w.document.querySelector('#aes-row-AAABBB .aes-routeIndex').textContent,'80');
});

test('numeric filters preserve inclusive thresholds and selection ignores hidden routes',async t=>{
    const routes=schedule();routes.date['20260908'].schedule.push({...route,origin:'AAA',destination:'CCC',od:'AAACCC',flightNumber:{200:{paxFreq:8,cargoFreq:0}}});
    const p=dashboard(t,'routeManagement',{settings:{general:{defaultDashboard:'routeManagement'},routeManagement:{filter:[{filterValue:'aes-paxFreq',operation:'>',value:'8'}]}},paine42schedule:routes});await load(p,'#aes-table-routeManagement tbody tr');
    assert.equal(p.w.document.querySelector('#aes-row-AAABBB').style.display,'none');assert.equal(p.w.document.querySelector('#aes-row-AAACCC').style.display,'');
    button(p,'Select first 10').click();button(p,'Open inventory (max 10)').click();assert.deepEqual(p.opened,[['https://paine.airlinesim.aero/app/com/inventory/AAACCC','_blank']]);await until(()=>!button(p,'Open inventory (max 10)').disabled);
});

test('column preferences survive regeneration without changing route data',async t=>{
    const p=dashboard(t,'routeManagement',{paine42schedule:schedule()});await load(p,'#aes-table-routeManagement tbody tr');
    const input=p.w.document.querySelector('.aes-dashboard-column-choice input[value="aes-origin"]');input.click();
    assert.equal(p.saved.settings.routeManagement.tableColumns.find(c=>c.class==='aes-origin').show,0);
    assert.equal(p.w.document.querySelector('#aes-row-AAABBB .aes-origin'),null);assert.deepEqual(p.saved.paine42schedule,schedule());
});

test('failed aircraft removal leaves rows, fleet and profit records intact',async t=>{
    const fleet={fleet:[{aircraftId:1,registration:'AA-1'}]};
    const p=dashboard(t,'aircraftProfitability',{paine42aircraftFleet:fleet,paineaircraftFlights1:{aircraftId:1}});await load(p,'#aircraft-id-1');
    p.w.document.querySelector('#aircraft-id-1 input').click();button(p,'Remove aircraft').click();p.failures.set='Write failed';button(p,'Confirm remove 1').click();await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(p.saved.paine42aircraftFleet,fleet);assert.ok(p.saved.paineaircraftFlights1);assert.ok(p.w.document.querySelector('#aircraft-id-1'));assert.ok(p.errors.length);
});

test('failed legacy competitor migration never deletes the original record',async t=>{
    const legacy={key:'paine99competitorMonitoring',type:'competitorMonitoring',server:'paine',id:'99',tracking:1,tab0:{broken:null},tab2:{},extra:'keep'};
    const p=dashboard(t,'competitorMonitoring',{paine99competitorMonitoring:legacy});p.failures.set='Write failed';await load(p);await until(()=>p.errors.length);
    assert.deepEqual(p.saved.paine99competitorMonitoring,legacy);assert.equal(p.saved.paine42_99competitorMonitoring,undefined);
});

test('legacy competitor migration retains unknown history and owner-scoped metadata',async t=>{
    const legacy={key:'paine99competitorMonitoring',type:'competitorMonitoring',server:'paine',id:'99',tracking:1,tab0:{broken:null},tab2:{},extra:'keep'};
    const p=dashboard(t,'competitorMonitoring',{paine99competitorMonitoring:legacy});await load(p,'#aes-compMon-row-99');
    assert.deepEqual(p.saved.paine42_99competitorMonitoring.tab0,{broken:null});assert.equal(p.saved.paine42_99competitorMonitoring.extra,'keep');assert.equal(p.saved.paine42_99competitorMonitoring.ownerId,'42');assert.equal(p.saved.paine99competitorMonitoring,undefined);
});

test('late aircraft reads cannot replace another dashboard tab',async t=>{
    const p=dashboard(t,'aircraftProfitability',{paine42aircraftFleet:{fleet:[{aircraftId:1,registration:'AA-1'}]}});
    const get=p.w.chrome.storage.local.get;let finish;
    p.w.chrome.storage.local.get=(keys,callback)=>Array.isArray(keys)&&keys.includes('paine42aircraftFleet')?(finish=()=>get(keys,callback)):get(keys,callback);
    await load(p);await until(()=>finish);p.w.$('#aes-select-dashboard-main').val('general').trigger('change');finish();
    assert.ok(p.w.document.querySelector('#aes-div-dashboard-general'));assert.equal(p.w.document.querySelector('#aircraft-id-1'),null);
});

test('ownership loss during initialization prevents mounting and settings writes',async t=>{
    const p=dashboard(t);const get=p.w.chrome.storage.local.get;let finish;
    p.w.chrome.storage.local.get=(keys,callback)=>{finish=()=>get(keys,callback);};p.load('content_dashboard.js');await until(()=>finish);
    p.run('AES.isPageOwner=()=>false; AES._ownershipLostCallbacks.forEach(fn=>fn());');finish();
    assert.equal(p.w.document.querySelector('#aes-dashboard-root'),null);assert.equal(p.calls.length,0);
});

test('schedule collects from dashboard without a native link, navigation or auto-extract flag',async t=>{
    const p=dashboard(t);const requests=require('./support/read-pages.cjs').install(p);await load(p);button(p,'Extract schedule data').click();
    await until(()=>p.saved.paine42schedule);
    assert.equal(p.saved.settings.schedule.autoExtract,undefined);
    assert.equal(requests.length,1);assert.equal(new URL(requests[0].url).searchParams.get('tab'),'3');assert.deepEqual(p.opened,[]);
    assert.equal(p.saved.paine42schedule.date['20260908'].schedule.length,1);
});

test('failed settings reads do not overwrite preferences or report saved filters',async t=>{
    const p=dashboard(t,'routeManagement',{paine42schedule:schedule()});await load(p,'#aes-table-routeManagement tbody tr');
    const before=JSON.parse(JSON.stringify(p.saved.settings));p.failures.get='Read failed';button(p,'Apply filter').click();
    assert.deepEqual(p.saved.settings,before);assert.ok(p.errors.length);
    assert.doesNotMatch(p.w.document.querySelector('.aes-dashboard-filter-status').textContent,/Done|Saved/);
});


test('aircraft removal preserves unrecognized records added after rendering',async t=>{
    const p=dashboard(t,'aircraftProfitability',{paine42aircraftFleet:{fleet:[{aircraftId:1,registration:'AA-1'}]}});await load(p,'#aircraft-id-1');
    const unknown={legacyPayload:'keep'};p.saved.paine42aircraftFleet.fleet.push(unknown);
    p.w.document.querySelector('#aircraft-id-1 input').click();button(p,'Remove aircraft').click();button(p,'Confirm remove 1').click();await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(p.saved.paine42aircraftFleet.fleet,[unknown]);
});

for (const [label, message] of [
    ['Open aircraft (max 10)', 'No delivered aircraft selected'],
    ['Remove aircraft', 'Select aircraft first'],
]) {
    test('empty selection restores dashboard button: ' + label, {timeout:5000}, async t => {
        const p=dashboard(t,'aircraftProfitability',{paine42aircraftFleet:{fleet:[{aircraftId:1,registration:'AA-1'}]}});
        await load(p,'#aircraft-id-1');
        const before=JSON.stringify(p.saved), control=p.w.$(button(p,label));
        assert.doesNotThrow(()=>control.trigger('click'));
        assert.equal(control.text(),message);
        await new Promise(resolve=>control.promise().done(resolve));
        assert.equal(control.text(),label);
        assert.equal(JSON.stringify(p.saved),before);
        assert.deepEqual(p.opened,[]);
    });
}

test('empty competitor selection restores removal button without changing storage', {timeout:5000}, async t => {
    const key='paine42_99competitorMonitoring';
    const p=dashboard(t,'competitorMonitoring',{paine42competitorMonitoringIndex:['99'],[key]:{key,type:'competitorMonitoring',server:'paine',ownerId:'42',id:'99',tracking:1,tab0:{'20260908':{id:'99',displayName:'Other Air'}},tab2:{}}});
    await load(p,'#aes-compMon-row-99');
    const before=JSON.stringify(p.saved), control=p.w.$(button(p,'Remove airline'));
    assert.doesNotThrow(()=>control.trigger('click'));
    assert.equal(control.text(),'Select airline first');
    await new Promise(resolve=>control.promise().done(resolve));
    assert.equal(control.text(),'Remove airline');
    assert.equal(JSON.stringify(p.saved),before);
});

test('dashboard queues at most ten routes and suppresses duplicate batch clicks',async t=>{
    const routes=schedule();routes.date['20260908'].schedule=Array.from({length:12},(_,i)=>({...route,origin:'AAA',destination:'B'+i,od:'AAAB'+i}));
    const p=dashboard(t,'routeManagement',{paine42schedule:routes});await load(p,'#aes-table-routeManagement tbody tr');
    p.w.document.querySelectorAll('#aes-table-routeManagement tbody input').forEach(input=>input.click());
    const control=button(p,'Open inventory (max 10)');control.click();control.click();
    await until(()=>!control.disabled);assert.equal(p.opened.length,10);assert.equal(new Set(p.opened.map(x=>x[0])).size,10);
});
test('blocked background queue never falls back to window.open',async t=>{
    const p=dashboard(t,'routeManagement',{paine42schedule:schedule()});await load(p,'#aes-table-routeManagement tbody tr');
    p.w.chrome.runtime.sendMessage=(message,callback)=>callback({ok:false,error:'Queue unavailable'});
    p.w.document.querySelector('#aes-row-AAABBB input').click();button(p,'Open inventory (max 10)').click();
    await until(()=>!button(p,'Open inventory (max 10)').disabled);assert.equal(p.opened.length,0);assert.ok(p.errors.length);
});

test('competitor collection updates existing rows and schedule cache without resetting selection or sort',async t=>{
    const record=id=>({key:`paine42_${id}competitorMonitoring`,type:'competitorMonitoring',server:'paine',ownerId:'42',id,tracking:1,tab0:{'20260908':{id,code:'OA',displayName:'Old '+id,rating:'AAA',pax:Number(id),fleet:2}},tab2:{}});
    const p=dashboard(t,'competitorMonitoring',{paine42competitorMonitoringIndex:['99','100'],paine42_99competitorMonitoring:record('99'),paine42_100competitorMonitoring:record('100')});
    require('./support/read-pages.cjs').install(p);
    await load(p,'#aes-compMon-row-99');
    const table=p.w.document.querySelector('#aes-table-competitorMonitoring'), row=p.w.document.querySelector('#aes-compMon-row-99');
    row.querySelector('input').click();
    const sort=p.w.$(table).find('thead .aes-table-sort').filter((_,el)=>el.textContent==='Total pax');
    assert.equal(sort.length,1);assert.equal(sort[0].tagName,'BUTTON');sort.trigger('click');
    assert.equal(sort.closest('th').attr('aria-sort'),'descending');
    button(p,'Refresh selected data').click();
    await until(()=>p.w.document.querySelector('.aes-read-feedback').textContent.includes('Updated 1, failed 0.'));
    assert.equal(p.w.document.querySelector('#aes-table-competitorMonitoring'),table);
    assert.equal(p.w.document.querySelector('#aes-compMon-row-99'),row);
    assert.equal(row.querySelector('input').checked,true);
    assert.match(row.textContent,/Other Air/);
    assert.equal(row.querySelector('.aes-overviewTotalPax').textContent,'1000');
    assert.equal(table.tBodies[0].rows[0],row);
    assert.equal(button(p,'Refresh selected data').parentElement.querySelector('[role=status]'),null);
    button(p,'Show airline schedule').click();
    assert.match(p.w.document.querySelector('#aes-table-competitorMonitoring-airline-schedule').textContent,/AAA/);
});

test('shared sorting preserves tied row order, selection and event handlers across refresh',t=>{
    const p=browser(t,{html:'<table id="sort"><tbody><tr id="a"><td class="value">2</td><td><input type="checkbox" checked></td></tr><tr id="b"><td class="value">1</td></tr><tr id="c"><td class="value">2</td></tr></tbody></table>'});
    p.load('modules/dashboard-table.js');
    let clicks=0;
    p.w.$('#a').on('click',()=>clicks++).data('retained','yes');
    p.run("AESDashboardTable.sort($('#sort'),'value',true,false)");
    assert.deepEqual([...p.w.document.querySelectorAll('tr')].map(row=>row.id),['a','c','b']);
    assert.equal(p.w.document.querySelector('#a input').checked,true);
    p.w.$('#a').trigger('click');
    assert.equal(clicks,1);assert.equal(p.w.$('#a').data('retained'),'yes');
    p.w.$('#b .value').text('3');
    p.run("AESDashboardTable.sort($('#sort'),'value',true,false)");
    assert.deepEqual([...p.w.document.querySelectorAll('tr')].map(row=>row.id),['b','a','c']);
});

for(const value of ['Active',require('../extension/locales/zh-TW.json').Active])test(`translated status columns accept canonical and displayed filters: ${value}`,async t=>{
    const p=dashboard(t,'aircraftProfitability',{aesLanguage:'zh-TW',settings:{general:{defaultDashboard:'aircraftProfitability'},aircraftProfitability:{filter:[{titlecode:'scheduleStateLabel',operation:'=',value}]}},paine42aircraftFleet:{fleet:[{aircraftId:1,registration:'AA-1',scheduleStateLabel:'Active'},{aircraftId:2,registration:'AA-2',scheduleStateLabel:'Locked'}]}});
    await load(p,'#aircraft-id-1');
    assert.equal(p.w.document.querySelector('#aircraft-id-1').style.display,'');
    assert.equal(p.w.document.querySelector('#aircraft-id-2').style.display,'none');
    const cell=p.w.document.querySelector('#aircraft-id-1 [data-aes-filter-value="Active"]');
    assert.equal(cell.textContent,require('../extension/locales/zh-TW.json').Active);
});

test('dashboard disclosures are native buttons with linked expansion state',async t=>{
    const p=dashboard(t,'routeManagement',{paine42schedule:schedule()});await load(p,'#aes-table-routeManagement tbody tr');
    const toggles=[...p.w.document.querySelectorAll('.aes-dashboard-disclosure')];assert.ok(toggles.length);
    for(const button of toggles){
        assert.equal(button.tagName,'BUTTON');assert.equal(button.type,'button');
        const expanded=button.getAttribute('aria-expanded')==='true';
        const body=p.w.document.getElementById(button.getAttribute('aria-controls'));assert.ok(body);
        button.click();assert.equal(button.getAttribute('aria-expanded'),String(!expanded));
        assert.equal(body.style.display==='none',expanded);
    }
});

// Defaults captured from v0.8.13 (7d92c034), not synthesized from current defaults.
for(const locale of ['en','de','es','fr','hu','nl','pl','zh-TW','ja'])test(`${locale}: legacy dashboard delta labels migrate without changing preferences`,async t=>{
    const legacy=structuredClone(require('./fixtures/dashboard-settings-0.8.13.json'));
    legacy.routeManagement.tableColumns.reverse();
    legacy.competitorMonitoring.tableColumns.reverse();
    legacy.routeManagement.filter=[{filterValue:'aes-paxFreq',operation:'>',value:'8'}];
    legacy.competitorMonitoring.filter=[{filterValue:'overviewFleet',operation:'>',value:'2'}];
    legacy.routeManagement.tableColumns[0].show=0;
    legacy.competitorMonitoring.tableColumns[0].visible=0;
    const p=dashboard(t,'competitorMonitoring',{aesLanguage:locale,paine42schedule:schedule(),settings:{...legacy,general:{defaultDashboard:'competitorMonitoring',dashboardFilterScopeKey:'paine:42'}}});
    await load(p,'.aes-dashboard-column-choice');
    const messages=require('../extension/locales/'+locale+'.json');
    for(const [section,label] of [['routeManagement','name'],['competitorMonitoring','text']]){
        const expected=structuredClone(legacy[section]);
        for(const column of expected.tableColumns) column[label]=column[label].replaceAll('&Delta;','Δ');
        assert.deepEqual(p.saved.settings[section].tableColumns,expected.tableColumns);
        assert.deepEqual(p.saved.settings[section].filter,expected.filter);
        if(section==='competitorMonitoring'){
            const labels=[...p.w.document.querySelectorAll('.aes-dashboard-column-choice span')].map(e=>e.textContent);
            for(const column of expected.tableColumns) assert.ok(labels.includes(messages[column.text]||column.text),column.text);
        }
    }
    const select=p.w.document.querySelector('#aes-select-dashboard-main');select.value='routeManagement';select.dispatchEvent(new p.w.Event('change'));
    await until(()=>p.w.document.querySelector('#aes-div-dashboard-routeManagement'));
    const labels=[...p.w.document.querySelectorAll('.aes-dashboard-column-choice span')].map(e=>e.textContent);
    for(const column of legacy.routeManagement.tableColumns){const text=column.name.replaceAll('&Delta;','Δ');assert.ok(labels.includes(messages[text]||text),text);}
    assert.equal(p.w.document.body.textContent.includes('&Delta;'),false);
});

test('legacy label migration preserves custom text and repairs the old FKO field typo',async t=>{
    const legacy=structuredClone(require('./fixtures/dashboard-settings-0.8.13.json'));
    const custom='<img src=x onerror="alert(1)"> &Delta;';
    legacy.routeManagement.tableColumns.find(c=>c.class==='aes-paxLoadDelta').name=custom;
    legacy.competitorMonitoring.tableColumns.find(c=>c.field==='overviewRatingDelta').text=custom;
    legacy.competitorMonitoring.tableColumns.find(c=>c.field==='faffkoDelta').field='faffkoDela';
    const p=dashboard(t,'competitorMonitoring',{settings:{...legacy,general:{defaultDashboard:'competitorMonitoring'}}});
    await load(p,'.aes-dashboard-column-choice');
    assert.equal(p.saved.settings.routeManagement.tableColumns.find(c=>c.class==='aes-paxLoadDelta').name,custom);
    assert.equal(p.saved.settings.competitorMonitoring.tableColumns.find(c=>c.field==='overviewRatingDelta').text,custom);
    assert.equal(p.saved.settings.competitorMonitoring.tableColumns.find(c=>c.field==='faffkoDelta').text,'FKO Δ');
    assert.equal(p.w.document.querySelector('.aes-dashboard-column-choice img'),null);
    assert.ok(p.w.document.body.textContent.includes(custom));
});
