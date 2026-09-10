const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser, until } = require('./support/browser.cjs');
const header = `<script>window.frontendSettings = {"fixedEnterpriseId":42,"server":{"time":"2026-09-08T00:00:00Z"}};</script><div id="header"><div><button aria-haspopup="menu"><span class="_name_test">AES Airlines</span><span class="_code_test">AA</span></button><div role="menubar"></div></div></div>`;
const templateKey = 'paine42flightPlanTemplate';
const jobKey = 'paine42flightPlanSchedulingJob';
const offsetKey = 'paine42flightPlanAssistantOffsetDays';
const block = (segment, start, end, classes = 'started ended') => `<div class="block flight ${classes}"><span class="code">AA 100</span><a title="View flight number" href="/app/com/numbers/10?segment=${segment}"></a><div class="times"><span class="start">${start}</span><span class="end">${end}</span></div></div>`;
const visual = days => `<div class="visual-flight-plan">${Array.from({length:7},(_,i) => `<div class="day"><div class="blocks">${days[i] || ''}</div></div>`).join('')}</div>`;
const select = (name, value) => `<select name="${name}"><option value="${value}" selected>${value}</option></select>`;
const planner = `<form><select name="existingNumber:numbers:numbers_body:input"><option value="10">AA 100</option><option value="20">AA 200</option></select>${Array.from({length:7},(_,i) => `<input type="checkbox" name="days:daySelection:${i}:ticked">${select(`segmentsContainer:segments:0:newArrivals:${i}:newArrival:hours`,'9')}${select(`segmentsContainer:segments:0:newArrivals:${i}:newArrival:minutes`,'30')}`).join('')}<input type="submit" name="button-submit"></form>`;
function page(t, {days = {}, data = {}, form = planner} = {}) {
    const p = browser(t,{path:'/app/fleets/aircraft/123/0',data,html:header + '<h1>Aircraft: AA-123 / A320</h1><h3>Assign a new flight</h3><div class="as-panel">'+form+'</div><h3>Transfer Flight Plan</h3>'+visual(days)});
    const setTimeout = p.w.setTimeout.bind(p.w);
    p.w.setTimeout = (fn,ms,...args) => setTimeout(fn,ms === 300 ? 0 : ms,...args);
    p.submissions = [];
    p.w.document.querySelector('form')?.addEventListener('submit', event => {
        event.preventDefault();
        p.submissions.push({job:JSON.parse(JSON.stringify(p.saved[jobKey])),days:[...p.w.document.querySelectorAll('input[type="checkbox"]')].map(c => c.checked)});
    });
    return p;
}
const entry = {flightCode:'AA 100',flightNumberLabel:'AA 100',flightNumberToken:'100',flightNumberValue:'10',selectedDays:[6],daySettings:{6:{departure:{hours:'07',minutes:'00',value:'0700',dayOffset:0},segments:{0:{arrival:{hours:'9',minutes:'30',value:'0930',dayOffset:0}}}}}};
const template = extra => ({type:'aircraftFlightPlanTemplate',schemaVersion:6,createdAt:1,date:'20260908',sourceAircraftId:'9',sourceRegistration:'AA-SOURCE',sourceModel:'A320',flights:[entry],...extra});
const job = extra => ({type:'aircraftFlightPlanSchedulingJob',createdAt:1,currentIndex:0,entries:[entry],errorMessage:'',offsetDays:1,sourceAircraftId:'9',sourceRegistration:'AA-SOURCE',status:'selecting',targetAircraftId:'123',targetModel:'A320',targetRegistration:'AA-123',...extra});
const button = (p,text) => [...p.w.document.querySelectorAll('#aes-aircraft-flight-plan-panel button')].find(b => b.textContent === text);
async function load(p) { p.load('content_aircraftFlightPlan.js'); await until(() => p.w.document.querySelector('#aes-aircraft-flight-plan-panel')); }

test('flight-plan extraction groups via legs under the service day across Sunday midnight', async t => {
    const p = page(t,{days:{6:block(0,'2300','','started'),0:block(0,'','0100','ended')+block(1,'0200','0400')}});
    await load(p);
    button(p,'Extract template').click();
    await until(() => p.saved[templateKey]);
    const stored = p.saved[templateKey];
    assert.equal(stored.schemaVersion,6);
    assert.equal(stored.sourceAircraftId,'123');
    assert.equal(stored.sourceRegistration,'AA-123');
    assert.equal(stored.flights.length,1);
    assert.deepEqual(stored.flights[0].selectedDays,[6]);
    assert.equal(stored.flights[0].daySettings[6].segments[0].arrival.dayOffset,1);
    assert.equal(stored.flights[0].daySettings[6].segments[0].arrival.value,'0100');
    assert.equal(stored.flights[0].daySettings[6].segments[1].arrival.value,'0400');
    assert.ok(!('_segments' in stored.flights[0]));
});

test('flight-plan HUB extraction counts locations with alphabetical tie breaking', async t => {
    const p = page(t,{days:{0:'<div class="block location"><span class="inbound" title="bbb"></span><span class="outbound">AAA</span></div>'}});
    await load(p);
    assert.deepEqual(p.saved.paine42aircraftFlightPlanHub123,{aircraftId:'123',counts:{BBB:1,AAA:1},hub:'AAA',server:'paine',type:'aircraftFlightPlanHub'});
});

test('starting a job offsets Sunday to Monday and persists waitForApply before form submission', async t => {
    const p = page(t,{data:{[templateKey]:template()}});
    await load(p);
    button(p,'Start scheduling').click();
    await until(() => p.submissions.length);
    assert.equal(p.saved[offsetKey],1);
    assert.equal(p.submissions[0].job.status,'waitForApply');
    assert.deepEqual(p.submissions[0].days,[true,false,false,false,false,false,false]);
    assert.equal(p.submissions.length,1);
});

test('resumed job completes only after scheduled days appear in the visual plan', async t => {
    const p = page(t,{days:{0:block(0,'0700','0930')},data:{[templateKey]:template(),[jobKey]:job({status:'waitForApply'})}});
    await load(p);
    await until(() => !p.saved[jobKey]);
    assert.equal(p.submissions.length,0);
    assert.match(p.w.document.querySelector('#aes-aircraft-flight-plan-runtime').textContent,/completed/);
    const q = page(t,{data:{[templateKey]:template(),[jobKey]:job({status:'waitForApply'})}});
    await load(q);
    await until(() => q.saved[jobKey].status === 'error');
    assert.match(q.saved[jobKey].errorMessage,/Could not confirm scheduled days/);
    assert.equal(q.submissions.length,0);
});

test('old template versions are removed and another aircraft job disables scheduling', async t => {
    const p = page(t,{data:{[templateKey]:template({schemaVersion:5}),[jobKey]:job({targetAircraftId:'999'}),[offsetKey]:'6'}});
    await load(p);
    assert.equal(p.saved[templateKey],undefined);
    assert.match(p.w.document.querySelector('#aes-aircraft-flight-plan-panel').textContent,/Template needs re-extract/);
    assert.equal(p.w.document.querySelector('.aes-aircraft-flight-plan-offset-btn.active').textContent,'6');
    assert.equal(p.saved[jobKey].status,'selecting');
    assert.equal(p.submissions.length,0);
    button(p,'Stop scheduling').click();
    await until(() => /target aircraft/.test(p.w.document.querySelector('#aes-aircraft-flight-plan-runtime').textContent));
    assert.equal(p.saved[jobKey].targetAircraftId,'999');
});

test('changing the flight selector saves waitForSelection without submitting a form', async t => {
    const otherEntry = {...entry,flightCode:'AA 200',flightNumberLabel:'AA 200',flightNumberToken:'200',flightNumberValue:'20'};
    const p = page(t,{data:{[jobKey]:job({entries:[otherEntry]})}});
    let changes = 0;
    p.w.document.querySelector('select').addEventListener('change',() => changes++);
    await load(p);
    await until(() => changes);
    assert.equal(p.saved[jobKey].status,'waitForSelection');
    assert.equal(p.w.document.querySelector('select').value,'20');
    assert.equal(p.submissions.length,0);
});

test('failed template writes preserve the previous template and allow retry', async t => {
    const original = template();
    const p = page(t,{days:{0:block(0,'0700','0930')},data:{[templateKey]:original}});
    await load(p);
    p.failures.set = 'Write failed';
    button(p,'Extract template').click();
    await until(() => /Write failed/.test(p.w.document.querySelector('#aes-aircraft-flight-plan-runtime').textContent));
    assert.deepEqual(p.saved[templateKey],original);
    assert.match(p.w.document.querySelector('#aes-aircraft-flight-plan-panel').textContent,/AA-SOURCE/);
    assert.equal(button(p,'Extract template').disabled,false);
    delete p.failures.set;
    button(p,'Extract template').click();
    await until(() => p.saved[templateKey].sourceAircraftId === '123');
});

test('failed template removal keeps the saved template available', async t => {
    const p = page(t,{data:{[templateKey]:template()}});
    await load(p);
    p.failures.remove = 'Remove failed';
    button(p,'Delete saved template').click();
    await until(() => /Remove failed/.test(p.w.document.querySelector('#aes-aircraft-flight-plan-runtime').textContent));
    assert.equal(p.saved[templateKey].sourceAircraftId,'9');
    assert.equal(button(p,'Delete saved template').disabled,false);
});

test('failed initial reads leave storage untouched and do not start a scheduling job', async t => {
    const original = job();
    const p = page(t,{data:{[jobKey]:original,[templateKey]:template()}});
    p.failures.get = 'Read failed';
    p.load('content_aircraftFlightPlan.js');
    await until(() => p.errors.length);
    assert.deepEqual(p.saved[jobKey],original);
    assert.equal(p.submissions.length,0);
    assert.equal(p.w.document.querySelector('#aes-aircraft-flight-plan-panel'),null);
});

test('failed scheduling state writes stop before form submission', async t => {
    const p = page(t,{data:{[templateKey]:template()}});
    await load(p);
    const originalSet = p.w.chrome.storage.local.set;
    p.w.chrome.storage.local.set = (values,callback) => {
        if (values[jobKey]?.status === 'waitForApply') {
            p.w.chrome.runtime.lastError = {message:'Job write failed'};
            try { callback(); } finally { delete p.w.chrome.runtime.lastError; }
        } else originalSet(values,callback);
    };
    button(p,'Start scheduling').click();
    await until(() => p.saved[jobKey]?.status === 'error');
    assert.match(p.saved[jobKey].errorMessage,/Job write failed/);
    assert.equal(p.submissions.length,0);
});

test('stop scheduling cancels a coroutine waiting for planner day updates', async t => {
    const p = page(t,{data:{[templateKey]:template()}});
    await load(p);
    button(p,'Start scheduling').click();
    await until(() => p.w.document.querySelector('input[type="checkbox"]').checked);
    button(p,'Stop scheduling').click();
    await until(() => !p.saved[jobKey]);
    await new Promise(resolve => setTimeout(resolve,180));
    assert.equal(p.submissions.length,0);
    assert.equal(p.saved[jobKey],undefined);
    assert.doesNotMatch(p.w.document.querySelector('#aes-aircraft-flight-plan-runtime').textContent,/failed/);
});

test('losing page ownership while applying prevents subsequent form submission', async t => {
    const p = page(t,{data:{[templateKey]:template()}});
    await load(p);
    button(p,'Start scheduling').click();
    await until(() => p.w.document.querySelector('input[type="checkbox"]').checked);
    p.run('AES.isPageOwner = () => false; AES._ownershipLostCallbacks.forEach(fn => fn());');
    const before = JSON.parse(JSON.stringify(p.saved[jobKey]));
    await new Promise(resolve => setTimeout(resolve,180));
    assert.equal(p.submissions.length,0);
    assert.deepEqual(p.saved[jobKey],before);
    assert.equal(p.w.document.querySelector('#aes-aircraft-flight-plan-panel'),null);
});

test('duplicate start clicks produce only one form submission', async t => {
    const p = page(t,{data:{[templateKey]:template()}});
    await load(p);
    const start = button(p,'Start scheduling');
    start.click(); start.click();
    await until(() => p.submissions.length);
    await new Promise(resolve => setTimeout(resolve,100));
    assert.equal(p.submissions.length,1);
});

test('failed job completion removal is never reported as successful completion', async t => {
    const p = page(t,{days:{0:block(0,'0700','0930')},data:{[jobKey]:job({status:'waitForApply'})}});
    p.failures.remove = 'Remove failed';
    await load(p);
    await until(() => p.saved[jobKey].currentIndex === 1);
    await new Promise(resolve => setTimeout(resolve,30));
    assert.ok(p.saved[jobKey]);
    assert.doesNotMatch(p.w.document.querySelector('#aes-aircraft-flight-plan-runtime').textContent,/completed/);
    assert.equal(p.submissions.length,0);
});

test('malformed current-version templates and jobs are retained without automatic submission', async t => {
    for (const changes of [{selectedDays:[]},{selectedDays:[7]},{daySettings:{6:{segments:{0:{arrival:{hours:9}}}}}}]) {
        const malformed = {...entry,...changes};
        const storedTemplate = template({flights:[malformed]});
        const storedJob = job({entries:[malformed]});
        const p = page(t,{data:{[templateKey]:storedTemplate,[jobKey]:storedJob}});
        await load(p);
        assert.deepEqual(p.saved[templateKey],storedTemplate);
        assert.deepEqual(p.saved[jobKey],storedJob);
        assert.match(p.w.document.querySelector('#aes-aircraft-flight-plan-hint').textContent,/Saved scheduling job is invalid/);
        assert.equal(p.submissions.length,0);
        button(p,'Stop scheduling').click();
        await until(() => !p.saved[jobKey]);
        assert.deepEqual(p.saved[templateKey],storedTemplate);
        assert.equal(button(p,'Start scheduling').disabled,true);
    }
});

test('pending initialization does not recreate the panel or save after ownership loss', async t => {
    const p = page(t,{data:{[templateKey]:template()}});
    let finish;
    const originalGet = p.w.chrome.storage.local.get;
    p.w.chrome.storage.local.get = (keys,callback) => { finish = () => originalGet(keys,callback); };
    p.load('content_aircraftFlightPlan.js');
    await until(() => finish);
    p.run('AES.isPageOwner = () => false; AES._ownershipLostCallbacks.forEach(fn => fn());');
    finish();
    await new Promise(resolve => setTimeout(resolve,30));
    assert.equal(p.w.document.querySelector('#aes-aircraft-flight-plan-panel'),null);
    assert.equal(p.saved[jobKey],undefined);
    assert.equal(p.submissions.length,0);
});

test('failed new-job save cannot change the planner selection or submit', async t => {
    const p = page(t,{data:{[templateKey]:template()}});
    await load(p);
    const originalSet = p.w.chrome.storage.local.set;
    p.w.chrome.storage.local.set = (values,callback) => {
        if (values[jobKey]) {
            p.w.chrome.runtime.lastError = {message:'Cannot save new job'};
            try { callback(); } finally { delete p.w.chrome.runtime.lastError; }
        } else originalSet(values,callback);
    };
    button(p,'Start scheduling').click();
    await until(() => /Cannot save new job/.test(p.w.document.querySelector('#aes-aircraft-flight-plan-runtime').textContent));
    assert.equal(p.saved[jobKey],undefined);
    assert.equal(p.submissions.length,0);
    assert.equal(p.w.document.querySelector('input[type="checkbox"]').checked,false);
    assert.equal(button(p,'Start scheduling').disabled,false);
});
