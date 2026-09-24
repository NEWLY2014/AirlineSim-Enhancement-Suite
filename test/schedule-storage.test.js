const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('./support/browser.cjs');
const {sender}=require('./support/coordinator.cjs');
const key='paine99schedule';
const schedule=[{origin:'AAA',destination:'BBB',od:'AAABBB',direction:'Outbound',flightNumber:{100:{paxFreq:7,cargoFreq:0,remark:'',valid:'Now'}}}];
const request=date=>({type:'AES_SAVE_SCHEDULE',airline:{id:'99',displayName:'Other Air'},snapshot:{date,updateTime:'00:00 UTC',schedule}});
const identity=()=>sender('https://paine.airlinesim.aero/app/info/enterprises/99?tab=3');
const send=(p,message,from=identity())=>new Promise(resolve=>p.dispatch(message,from,resolve));
const accept=p=>p.w.chrome.runtime.onMessage.addListener((message,source,reply)=>{if(message.type==='AES_SCHEDULE_OWNER_CHECK')reply({ok:true});});

test('background schedule saves serialize per airline and retain old dates and unknown fields',async t=>{
    const p=browser(t,{data:{[key]:{type:'schedule',date:{20260901:{keep:true}},extra:{keep:true}}}});accept(p);
    const results=await Promise.all(['20260908','20260909'].map(date=>send(p,request(date))));
    assert.ok(results.every(result=>result.ok));
    assert.deepEqual(Object.keys(p.saved[key].date),['20260901','20260908','20260909']);
    assert.deepEqual(p.saved[key].date['20260908'].schedule,schedule);
    assert.deepEqual(p.saved[key].date['20260901'],{keep:true});
    assert.deepEqual(p.saved[key].extra,{keep:true});
});

test('schedule worker refuses writes after the requesting page loses ownership',async t=>{
    const original={type:'schedule',date:{20260901:{keep:true}}};
    const p=browser(t,{data:{[key]:original}});
    p.w.chrome.runtime.onMessage.addListener((message,source,reply)=>reply({ok:false}));
    const result=await send(p,request('20260908'));
    assert.equal(result.ok,false);assert.deepEqual(p.saved[key],original);assert.equal(p.calls.length,0);
});

test('schedule storage read and write failures retain history and permit subsequent retry',async t=>{
    const original={type:'schedule',date:{20260901:{keep:true}}};
    const p=browser(t,{data:{[key]:original}});accept(p);
    for(const operation of ['get','set']){
        p.failures[operation]='Storage unavailable';
        const result=await send(p,request('20260908'));
        assert.equal(result.ok,false);assert.match(result.error,/Storage unavailable/);assert.deepEqual(p.saved[key],original);
        delete p.failures[operation];
    }
    assert.equal((await send(p,request('20260908'))).ok,true);
    assert.ok(p.saved[key].date['20260908']);
});

test('schedule save requests cannot target another airline or come from an untrusted page',async t=>{
    const p=browser(t);accept(p);const valid=identity();
    for(const from of [{...valid,id:'other-extension'},{...valid,frameId:1},{...valid,url:'https://example.com/app/info/enterprises/99?tab=3'},
        {...valid,url:'https://paine.airlinesim.aero/app/info/enterprises/42?tab=3'},{...valid,url:'https://paine.airlinesim.aero/app/info/enterprises/99?tab=7'}]){
        assert.equal((await send(p,request('20260908'),from)).ok,false);
    }
    const invalid=request('20260908');invalid.snapshot.schedule=null;
    assert.equal((await send(p,invalid)).ok,false);assert.equal(p.calls.length,0);
});

test('same-day collections retain the preceding capture and migrate the daily baseline',async t=>{
    const p=browser(t,{data:{[key]:{type:'schedule',date:{20260908:{date:'20260908',updateTime:'00:00 UTC',schedule}}}}});accept(p);
    await send(p,request('20260908'));
    assert.equal(Object.keys(p.saved[key].captures)[0],'daily:20260908');
    const first=Object.keys(p.saved[key].captures).at(-1);
    const changed=request('20260908');changed.snapshot.schedule=structuredClone(schedule);changed.snapshot.schedule[0].flightNumber[100].paxFreq=4;
    await send(p,changed);
    assert.equal(Object.keys(p.saved[key].captures).length,3);
    assert.equal(p.saved[key].captures[first].schedule[0].flightNumber[100].paxFreq,7);
    assert.equal(Object.values(p.saved[key].captures).at(-1).schedule[0].flightNumber[100].paxFreq,4);
    await send(p,changed);
    assert.equal(Object.keys(p.saved[key].captures).length,4);
    assert.equal(Object.keys(p.saved[key].date).length,1);
});


test('empty snapshot replaces the daily schedule while retaining all removed flights in history',async t=>{
    const baseline={date:'20260908',updateTime:'00:00 UTC',schedule};
    const p=browser(t,{data:{[key]:{type:'schedule',date:{20260908:baseline}}}});accept(p);
    const empty=request('20260908');empty.snapshot.schedule=[];
    assert.equal((await send(p,empty)).ok,true);
    assert.deepEqual(p.saved[key].date['20260908'].schedule,[]);
    assert.deepEqual(p.saved[key].captures['daily:20260908'].schedule,schedule);
    assert.equal(Object.keys(p.saved[key].captures).length,2);
    p.load('modules/schedule-diff.js');p.w.captures=Object.values(p.saved[key].captures);
    const diff=await p.run('AESScheduleDiff.compare(window.captures[0],window.captures[1])');
    assert.equal(diff.changes.length,1);assert.equal(diff.changes[0].kind,'Removed');
});
