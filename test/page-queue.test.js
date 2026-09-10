const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const source=readFileSync(`${__dirname}/../build/extension/modules/page-queue.js`,'utf8');
const url='https://paine.airlinesim.aero/app/com/inventory/AAABBB';
function queue(random=0.5) {
    let now=100000, nextTab=100, failWrite=false, failCreate=false;
    const saved={}, tabs=new Map([[1,{id:1,status:'complete'}],[2,{id:2,status:'complete'}]]), opened=[];
    let listeners;
    const clone=x=>JSON.parse(JSON.stringify(x));
    function boot() {
        listeners={};
        const chrome={runtime:{id:'aes',onMessage:{addListener:f=>listeners.message=f}},
            storage:{session:{get:async()=>clone(saved),set:async x=>{if(failWrite)throw Error('storage failed');Object.assign(saved,clone(x));}}},
            tabs:{create:async options=>{if(failCreate)throw Error('create failed');const tab={id:nextTab++,status:'loading'};tabs.set(tab.id,tab);opened.push({...options,time:now,id:tab.id});return tab;},
                update:async(id,options)=>{const tab=tabs.get(id);if(!tab)throw Error('closed');tab.status='loading';opened.push({...options,time:now,id});return tab;},
                get:async id=>{if(!tabs.has(id))throw Error('closed');return tabs.get(id);},
                onUpdated:{addListener:f=>listeners.updated=f},onRemoved:{addListener:f=>listeners.removed=f}}};
        runInNewContext(source,{chrome,URL,Date:{now:()=>now},Math:{random:()=>random,floor:Math.floor,max:Math.max},console});
    }
    boot();
    function message(op,id,kind='open',tab=1,destination=url,doc='doc'+tab) {
        return new Promise(resolve=>listeners.message({type:'AES_PAGE_QUEUE',op,id,kind,url:destination},{id:'aes',tab:{id:tab},documentId:doc,frameId:0,url},resolve));
    }
    return {message,opened,saved,tabs,boot,advance:ms=>now+=ms,failWrite:()=>failWrite=true,failCreate:()=>failCreate=true,
        updated:(id,status)=>{tabs.get(id).status=status;listeners.updated(id,{status});},closed:id=>{tabs.delete(id);listeners.removed(id);}};
}

test('queue applies randomized 30–70 ms dispatch gaps without waiting for loading',async()=>{
    for(const random of [0,0.5,0.999999]) {
        const q=queue(random);await q.message('enqueue','a');await q.message('enqueue','b','open',2);
        assert.equal(q.opened.length,1);
        const delay=30+Math.floor(random*41);q.advance(delay-1);await q.message('poll','b','open',2);assert.equal(q.opened.length,1);
        q.advance(1);await q.message('poll','b','open',2);assert.equal(q.opened.length,2);
        assert.equal(q.tabs.get(100).status,'loading');assert.equal(q.opened[1].time-q.opened[0].time,delay);
    }
});
test('price grant shares dispatch spacing but does not hold the queue during refresh',async()=>{
    const q=queue(0);await q.message('enqueue','price','price');
    assert.equal((await q.message('poll','price','price')).state,'running');
    await q.message('enqueue','open','open',2);assert.equal(q.opened.length,0);
    await q.message('complete','price','price');
    q.advance(30);await q.message('poll','open','open',2);assert.equal(q.opened.length,1);
    assert.equal(q.tabs.get(1).status,'complete');
});
test('worker restart preserves FIFO and never replays a dispatched tab',async()=>{
    const q=queue();await q.message('enqueue','a');await q.message('enqueue','b','open',2);q.boot();
    await q.message('poll','b','open',2);assert.equal(q.opened.length,1);
    q.updated(100,'complete');await q.message('poll','b','open',2);q.advance(2000);await q.message('poll','b','open',2);
    assert.equal(q.opened.length,2);assert.equal((await q.message('enqueue','a')).state,'done');assert.equal(q.opened.length,2);
});
test('closed or navigated source cancels waiting requests',async()=>{
    const q=queue();await q.message('enqueue','a');await q.message('enqueue','b','open',2);q.updated(2,'loading');
    assert.equal((await q.message('poll','b','open',2)).ok,false);
    q.closed(100);assert.equal((await q.message('poll','a')).state,'done');
});
test('unsupported URLs and another document cannot claim a queue request',async()=>{
    const q=queue();
    for(const bad of ['https://evil.test/app/com/inventory/X','http://paine.airlinesim.aero/app/com/inventory/X','https://paine.airlinesim.aero/app/fleets','https://other.airlinesim.aero/app/com/inventory/X'])assert.equal((await q.message('enqueue',bad,'open',1,bad)).ok,false);
    await q.message('enqueue','price','price');assert.equal((await q.message('poll','price','price',1,url,'different')).ok,false);
    assert.equal(q.opened.length,0);
});
test('queue storage failure prevents tab creation',async()=>{
    const q=queue();q.failWrite();assert.equal((await q.message('enqueue','a')).ok,false);assert.equal(q.opened.length,0);
});
test('creation failure is reported and is not retried',async()=>{
    const q=queue();q.failCreate();assert.equal((await q.message('enqueue','a')).ok,false);q.boot();assert.equal((await q.message('poll','a')).ok,false);assert.equal(q.opened.length,0);
});
test('loading completion does not reset the dispatch clock',async()=>{
    const q=queue(0);await q.message('enqueue','a');await q.message('enqueue','b','open',2);
    q.advance(20);q.updated(100,'complete');await q.message('poll','b','open',2);
    q.advance(10);await q.message('poll','b','open',2);assert.equal(q.opened.length,2);
});
test('abandoned waiting client expires and does not block a live client',async()=>{
    const q=queue();await q.message('enqueue','p','price');q.advance(120001);await q.message('enqueue','b','open',2);assert.equal(q.opened.length,1);
});
test('price permit is not granted by another page polling',async()=>{
    const q=queue();await q.message('enqueue','p','price');await q.message('enqueue','b','open',2);
    assert.equal(q.saved.aesPageQueueV1.jobs[0].state,'queued');assert.equal(q.opened.length,0);
});

test('simultaneous enqueue calls still dispatch only one tab',async()=>{
    const q=queue();await Promise.all([q.message('enqueue','a'),q.message('enqueue','b','open',2)]);
    assert.equal(q.opened.length,1);assert.equal(q.saved.aesPageQueueV1.jobs.filter(j=>j.state==='queued').length,1);
});
test('unknown creation outcome after restart is not replayed or load-blocking',async()=>{
    const q=queue();await q.message('enqueue','a');delete q.saved.aesPageQueueV1.jobs[0].target;q.saved.aesPageQueueV1.jobs[0].state='running';q.boot();
    q.advance(70);await q.message('enqueue','b','open',2);assert.equal(q.opened.length,2);
});
test('cancelled price permit releases the slot after cooldown',async()=>{
    const q=queue();await q.message('enqueue','p','price');await q.message('poll','p','price');
    await q.message('enqueue','b','open',2);await q.message('cancel','p','price');
    assert.equal(q.opened.length,0);q.advance(2000);await q.message('poll','b','open',2);assert.equal(q.opened.length,1);
});

test('read requests from different pages share completion-to-start gaps of 30–70 ms without opening tabs',async()=>{
    for (const random of [0,0.5,0.999999]){
        const q=queue(random),read='https://paine.airlinesim.aero/action/info/flight?id=1';
        await q.message('enqueue','r1','read',1,read);assert.equal((await q.message('poll','r1','read',1,read)).state,'running');
        await q.message('enqueue','r2','read',2,read);q.advance(100);
        assert.equal((await q.message('poll','r2','read',2,read)).state,'queued');
        q.boot();assert.equal((await q.message('poll','r2','read',2,read)).state,'queued');
        await q.message('complete','r1','read',1,read);
        const gap=30+Math.floor(random*41);q.advance(gap-1);
        assert.equal((await q.message('poll','r2','read',2,read)).state,'queued');
        q.advance(1);assert.equal((await q.message('poll','r2','read',2,read)).state,'running');
        assert.deepEqual(q.opened,[]);
    }
});
test('read request queue refuses action URLs and permits only explicit read-only targets',async()=>{
    const q=queue();
    for(const url of ['https://paine.airlinesim.aero/app/info/airports/1-1.ILinkListener-link.station~open',
        'https://paine.airlinesim.aero/app/info/enterprises/99?tab=3&select=99','https://paine.airlinesim.aero/action/enterprise/staffOverview']){
        assert.equal((await q.message('enqueue',url,'read',1,url)).ok,false);
    }
});
test('failed or cancelled read releases the queue with a cooldown before price operations',async()=>{
    const q=queue(0),read='https://paine.airlinesim.aero/action/info/flight?id=1';
    await q.message('enqueue','r','read',1,read);await q.message('poll','r','read',1,read);
    await q.message('enqueue','p','price',2);q.advance(100);
    assert.equal((await q.message('poll','p','price',2)).state,'queued');
    await q.message('cancel','r','read',1,read);q.advance(29);assert.equal((await q.message('poll','p','price',2)).state,'queued');
    q.advance(1);assert.equal((await q.message('poll','p','price',2)).state,'running');
});
