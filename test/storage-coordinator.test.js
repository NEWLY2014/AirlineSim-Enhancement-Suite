const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('./support/browser.cjs');
const {coordinator,sender}=require('./support/coordinator.cjs');
const key='paine42flightPlanSchedulingJob';
const job={type:'aircraftFlightPlanSchedulingJob',status:'selecting',targetAircraftId:'123',entries:[]};
const call=(dispatch,identity,op,extra={})=>new Promise(resolve=>dispatch({type:'AES_FLIGHT_PLAN_JOB',key,op,...extra},identity,resolve));
const identity=()=>sender('https://paine.airlinesim.aero/app/fleets/aircraft/123/0');

test('background serializes simultaneous job starts and rejects foreign tokens',async t=>{
    const p=browser(t),a=identity(),b=identity();
    const [first,second]=await Promise.all([call(p.dispatch,a,'create',{job}),call(p.dispatch,b,'create',{job})]);
    assert.equal(first.ok,true);assert.equal(second.ok,false);
    assert.equal((await call(p.dispatch,b,'clear',{token:first.token})).ok,false);
    assert.ok(p.saved[key]);
});

test('worker restart retains ownership; document reload revokes old token',async t=>{
    const p=browser(t),session={},a=identity(),b=identity();
    const dispatch=coordinator(p.w.chrome,{session});
    const start=await call(dispatch,a,'create',{job});
    const restarted=coordinator(p.w.chrome,{session});
    assert.equal((await call(restarted,b,'claim')).ok,false);
    assert.equal((await call(restarted,a,'check',{token:start.token})).ok,true);
    const reloaded={...a,documentId:'new-document'};
    const claim=await call(restarted,reloaded,'claim');assert.equal(claim.ok,true);
    assert.equal((await call(restarted,a,'save',{token:start.token,job})).ok,false);
    assert.equal((await call(restarted,a,'clear',{token:start.token})).ok,false);
    assert.equal((await call(restarted,reloaded,'clear',{token:claim.token})).ok,true);
    assert.equal(p.saved[key],undefined);
});

test('closed owner tab allows recovery on the correct aircraft',async t=>{
    const p=browser(t),session={},a=identity(),b=identity(),liveTabs=new Set([a.tab.id,b.tab.id]);
    const dispatch=coordinator(p.w.chrome,{session,liveTabs});
    await call(dispatch,a,'create',{job});liveTabs.delete(a.tab.id);
    assert.equal((await call(dispatch,b,'claim')).ok,true);
});

test('job storage failure leaves existing data intact and queue remains usable',async t=>{
    const p=browser(t),a=identity();p.failures.set='Write failed';
    assert.equal((await call(p.dispatch,a,'create',{job})).ok,false);assert.equal(p.saved[key],undefined);
    delete p.failures.set;
    assert.equal((await call(p.dispatch,a,'create',{job})).ok,true);
});

test('untrusted senders cannot mutate settings or scheduling jobs',async t=>{
    const p=browser(t),a=identity();
    for(const invalid of [{...a,id:'other-extension'},{...a,frameId:1},{...a,url:'https://example.com/app/'}]) {
        assert.equal((await call(p.dispatch,invalid,'create',{job})).ok,false);
        const response=await new Promise(resolve=>p.dispatch({type:'AES_SETTINGS_CAS',expected:'{}',next:{a:1}},invalid,resolve));
        assert.equal(response.ok,false);
    }
    assert.deepEqual(p.saved,{});
});
