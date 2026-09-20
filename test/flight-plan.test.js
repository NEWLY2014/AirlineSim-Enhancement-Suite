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
const choice = (name, selected, values) => `<select name="${name}">${values.map(value => `<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`).join('')}</select>`;
const planner = `<form><select name="existingNumber:numbers:numbers_body:input"><option value="10">AA 100</option><option value="20">AA 200</option></select>${Array.from({length:7},(_,i) => `<input type="checkbox" name="days:daySelection:${i}:ticked"><input type="checkbox" name="segmentsContainer:segments:0:fixedArrivalSelection:${i}:fixedArrival"${i===6 ? ' checked' : ''}>${select(`segmentsContainer:segments:0:newArrivals:${i}:newArrival:hours`,'9')}${select(`segmentsContainer:segments:0:newArrivals:${i}:newArrival:minutes`,'30')}`).join('')}<input type="submit" name="button-submit"></form>`;
const correctionPlanner = `<form>${Array.from({length:7},(_,i) => `<input type="checkbox" name="days:daySelection:${i}:ticked"${i === 0 ? ' checked' : ''}><input type="checkbox" name="segmentsContainer:segments:0:fixedArrivalSelection:${i}:fixedArrival"${i===6 ? ' checked' : ''}>${choice(`segmentsContainer:segments:0:newArrivals:${i}:newArrival:hours`,'9',['9'])}${choice(`segmentsContainer:segments:0:newArrivals:${i}:newArrival:minutes`,i === 0 ? '51' : '30',['30','51'])}`).join('')}<input type="submit" name="button-submit"></form>`;
function page(t, {days = {}, data = {}, form = planner} = {}) {
    const p = browser(t,{path:'/app/fleets/aircraft/123/0',data,html:header + '<h1>Aircraft: AA-123 / A320</h1><h3>Assign a new flight</h3><div class="as-panel">'+form+'</div><h3>Transfer Flight Plan</h3>'+visual(days)});
    const setTimeout = p.w.setTimeout.bind(p.w);
    p.w.setTimeout = (fn,ms,...args) => setTimeout(fn,ms === 300 || ms === 1500 ? 0 : ms,...args);
    p.submissions = [];
    p.w.document.addEventListener('submit', event => {
        event.preventDefault();
        p.submissions.push({
            job:JSON.parse(JSON.stringify(p.saved[jobKey])),
            days:[...p.w.document.querySelectorAll('input[name^="days:daySelection:"]')].map(c => c.checked),
            fixedArrivals:[...p.w.document.querySelectorAll('input[name*="fixedArrivalSelection"]')].map(c => c.checked)
        });
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

test('flight-plan HUB extraction immediately updates fleet and profit consumers', async t => {
    const fleet={type:'aircraftFleet',server:'paine',extra:'keep',fleet:[
        {aircraftId:123,registration:'AA-123',hubDetected:'OLD',hubEffective:'CCC',hubOverride:'CCC',note:'keep'},
        {aircraftId:999,registration:'AA-999',hubDetected:'OTHER'},
        {aircraftId:{malformed:true},unknown:'keep'}
    ]};
    const summary={type:'aircraftFlights',aircraftId:123,date:'20260908',time:'00:00 UTC',finishedFlights:2,totalFlights:2,
        profit:80,profitFlights:2,hubDetected:'OLD',hubEffective:'CCC',hubOverride:'CCC',extra:'keep'};
    const p=page(t,{days:{0:'<div class="block location"><span class="inbound" title="bbb"></span><span class="outbound">AAA</span><span class="outbound">AAA</span></div>'},
        data:{paine42aircraftFleet:fleet,paineaircraftFlights123:summary}});
    await load(p);
    assert.equal(p.saved.paine42aircraftFleet.extra,'keep');
    assert.deepEqual(p.saved.paine42aircraftFleet.fleet[0],{...fleet.fleet[0],hubDetected:'AAA',hubEffective:'CCC',hubDetectionSource:'flightPlan'});
    assert.deepEqual(p.saved.paine42aircraftFleet.fleet[1],fleet.fleet[1]);
    assert.deepEqual(p.saved.paine42aircraftFleet.fleet[2],fleet.fleet[2]);
    assert.deepEqual(p.saved.paineaircraftFlights123,{...summary,hubCounts:{BBB:1,AAA:2},hubDetected:'AAA',hubEffective:'CCC',hubDetectionSource:'flightPlan'});
});

test('starting a job offsets Sunday to Monday and persists waitForApply before form submission', async t => {
    const p = page(t,{data:{[templateKey]:template()}});
    await load(p);
    button(p,'Start scheduling').click();
    await waitForPlanner(() => p.submissions.length);
    assert.equal(p.saved[offsetKey],1);
    assert.equal(p.submissions[0].job.status,'waitForApply');
    assert.deepEqual(p.submissions[0].days,[true,false,false,false,false,false,false]);
    assert.deepEqual(p.submissions[0].fixedArrivals,[true,false,false,false,false,false,true]);
    assert.equal(p.submissions.length,1);
});

test('resumed job completes only after scheduled days and fixed arrival times appear', async t => {
    const p = page(t,{days:{0:block(0,'0700','0930')},data:{[templateKey]:template(),[jobKey]:job({status:'waitForApply'})}});
    await load(p);
    await until(() => !p.saved[jobKey]);
    assert.equal(p.submissions.length,0);
    assert.match(p.w.document.querySelector('#aes-aircraft-flight-plan-runtime').textContent,/completed/);

    const wrongDay = page(t,{days:{1:block(0,'0700','0930')},data:{[templateKey]:template(),[jobKey]:job({status:'waitForApply'})}});
    await load(wrongDay);
    await until(() => wrongDay.saved[jobKey].status === 'error');
    assert.match(wrongDay.saved[jobKey].errorMessage,/Could not confirm scheduled days and arrival times/);
    assert.equal(wrongDay.submissions.length,0);

    const wrongArrival = page(t,{days:{0:block(0,'0700','0951')},data:{[templateKey]:template(),[jobKey]:job({status:'waitForApply'})}});
    await load(wrongArrival);
    await until(() => wrongArrival.saved[jobKey].status === 'error');
    assert.match(wrongArrival.saved[jobKey].errorMessage,/Could not confirm scheduled days and arrival times/);
    assert.equal(wrongArrival.submissions.length,0);

    const q = page(t,{data:{[templateKey]:template(),[jobKey]:job({status:'waitForApply'})}});
    await load(q);
    await until(() => q.saved[jobKey].status === 'error');
    assert.match(q.saved[jobKey].errorMessage,/Could not confirm scheduled days and arrival times/);
    assert.equal(q.submissions.length,0);
});

test('arrival mismatch opens the scheduled flight, corrects it once and verifies the result', async t => {
    const editable = block(0,'0700','0951').replace('</div></div>','<a title="Set planner to this flight number" href="#edit"></a></div></div>');
    const p = page(t,{days:{0:editable},data:{[templateKey]:template(),[jobKey]:job({status:'waitForApply'})}});
    p.w.document.querySelector('a[title="Set planner to this flight number"]').addEventListener('click', event => {
        event.preventDefault();
        p.w.document.querySelector('.as-panel').innerHTML = correctionPlanner;
    });
    await load(p);
    await waitForPlanner(() => p.submissions.length === 1);
    assert.equal(p.submissions[0].job.status,'waitForCorrectionApply');
    assert.equal(p.submissions[0].fixedArrivals[0],true);
    assert.equal(p.w.document.querySelector('select[name="segmentsContainer:segments:0:newArrivals:0:newArrival:minutes"]').value,'30');

    const corrected = page(t,{days:{0:block(0,'0700','0930')},data:{[templateKey]:template(),[jobKey]:job({status:'waitForCorrectionApply'})}});
    await load(corrected);
    await until(() => !corrected.saved[jobKey]);
    assert.match(corrected.w.document.querySelector('#aes-aircraft-flight-plan-runtime').textContent,/completed/);

    const failed = page(t,{days:{0:block(0,'0700','0951')},data:{[templateKey]:template(),[jobKey]:job({status:'waitForCorrectionApply'})}});
    await load(failed);
    await until(() => failed.saved[jobKey].status === 'error');
    assert.match(failed.saved[jobKey].errorMessage,/Automatic arrival time correction failed/);
    assert.equal(failed.submissions.length,0);
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
    await waitForPlanner(() => p.submissions.length);
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


test('correction never submits an unrelated preloaded planner', async t => {
    const wrong = planner.replace('<option value="20">', '<option value="20" selected>').replace('name="days:daySelection:0:ticked"', 'name="days:daySelection:0:ticked" checked');
    const p = page(t, {form:wrong, days:{0:block(0,'0700','0951')}, data:{[jobKey]:job({status:'correcting'})}});
    await load(p);
    await until(() => p.saved[jobKey].status === 'error');
    assert.equal(p.submissions.length, 0);
});


test('arrival confirmation distinguishes same-day and next-day times', async t => {
    const expected = structuredClone(entry);
    expected.daySettings[6].segments[0].arrival.dayOffset = 1;
    const wrong = page(t,{days:{0:block(0,'0700','0930')},data:{[jobKey]:job({status:'waitForApply',entries:[expected]})}});
    await load(wrong);
    await until(() => wrong.saved[jobKey]?.status === 'error');
    assert.equal(wrong.submissions.length,0);
    const correct = page(t,{days:{0:block(0,'0700','','started'),1:block(0,'','0930','ended')},data:{[jobKey]:job({status:'waitForApply',entries:[expected]})}});
    await load(correct);
    await until(() => !correct.saved[jobKey]);
    assert.equal(correct.submissions.length,0);
});

async function waitForPlanner(check) {
    const deadline=Date.now()+6000;
    while(Date.now()<deadline){if(check())return;await new Promise(resolve=>setTimeout(resolve,20));}
    assert.ok(check(),'Planner did not reach the expected state');
}
test('planner rechecks fixed arrivals after a time-change redraw clears the checkbox',async t=>{
    const form=planner.replace('newArrival:minutes"><option value="30" selected>30</option>', 'newArrival:minutes"><option value="51" selected>51</option><option value="30">30</option>');
    const p=page(t,{form,data:{[templateKey]:template()}});let redraws=0;
    p.w.document.addEventListener('change',event=>{
        if(event.target.name?.includes('newArrival:minutes')){
            const fixed=p.w.document.querySelector('input[name*="fixedArrivalSelection:0:"]');
            fixed.checked=false;redraws++;
        }
    });
    await load(p);button(p,'Start scheduling').click();await waitForPlanner(()=>p.submissions.length);
    assert.ok(redraws>0);assert.equal(p.submissions[0].fixedArrivals[0],true);
});
test('planner repairs a delayed reset after saving its pending job',async t=>{
    const p=page(t,{data:{[templateKey]:template()}});
    const set=p.w.chrome.storage.local.set;
    p.w.chrome.storage.local.set=(values,callback)=>{
        if(values[jobKey]?.status==='waitForApply')p.w.setTimeout(()=>{
            p.w.document.querySelector('input[name*="fixedArrivalSelection:0:"]').checked=false;
        },100);
        return set(values,callback);
    };
    await load(p);button(p,'Start scheduling').click();await waitForPlanner(()=>p.submissions.length);
    assert.equal(p.submissions[0].fixedArrivals[0],true);assert.equal(p.submissions.length,1);
});

test('planner never submits if fixed arrival keeps being reset',async t=>{
    const p=page(t,{data:{[templateKey]:template()}});let reset;
    const set=p.w.chrome.storage.local.set;
    p.w.chrome.storage.local.set=(values,callback)=>{
        if(values[jobKey]?.status==='waitForApply')reset=p.w.setInterval(()=>{
            p.w.document.querySelector('input[name*="fixedArrivalSelection:0:"]').checked=false;
        },20);
        return set(values,callback);
    };
    t.after(()=>p.w.clearInterval(reset));
    await load(p);button(p,'Start scheduling').click();await waitForPlanner(()=>p.saved[jobKey]?.status==='error');
    assert.equal(p.submissions.length,0);
    assert.match(p.saved[jobKey].errorMessage,/arrival/);
});

test('unfixed source day clears target fixed arrival without editing the automatic arrival',async t=>{
    const p=page(t,{data:{[templateKey]:template()}});
    p.w.document.querySelector('input[name*="fixedArrivalSelection:6:"]').checked=false;
    p.w.document.querySelector('input[name*="fixedArrivalSelection:0:"]').checked=true;
    const minutes=p.w.document.querySelector('select[name*="newArrivals:0:newArrival:minutes"]');
    minutes.innerHTML='<option value="51">51</option>';
    await load(p);button(p,'Start scheduling').click();await waitForPlanner(()=>p.submissions.length);
    assert.equal(p.submissions[0].fixedArrivals[0],false);
    assert.equal(minutes.value,'51');
    assert.equal(p.submissions[0].job.entries[0].arrivalModes[0][6],false);
    assert.equal(p.saved[templateKey].flights[0].arrivalModes,undefined);
});
test('mixed source days are captured before overlapping target days change them',async t=>{
    const mixed={...entry,selectedDays:[0,6],daySettings:{0:entry.daySettings[6],6:entry.daySettings[6]}};
    const p=page(t,{data:{[templateKey]:template({flights:[mixed]})}});
    p.w.document.querySelector('input[name*="fixedArrivalSelection:0:"]').checked=true;
    p.w.document.querySelector('input[name*="fixedArrivalSelection:6:"]').checked=false;
    await load(p);button(p,'Start scheduling').click();await waitForPlanner(()=>p.submissions.length);
    assert.equal(p.submissions[0].fixedArrivals[0],false);
    assert.equal(p.submissions[0].fixedArrivals[1],true);
    assert.deepEqual(p.submissions[0].job.entries[0].arrivalModes,{'0':{'0':true,'6':false}});
});
test('unfixed arrivals may differ after submission without triggering fixed-time correction',async t=>{
    const unfixed={...entry,arrivalModes:{0:{6:false}}};
    const p=page(t,{days:{0:block(0,'0700','0951')},data:{[templateKey]:template(),[jobKey]:job({status:'waitForApply',entries:[unfixed]})}});
    await load(p);await until(()=>!p.saved[jobKey]);
    assert.equal(p.submissions.length,0);
    assert.match(p.w.document.querySelector('#aes-aircraft-flight-plan-runtime').textContent,/completed/);
});
