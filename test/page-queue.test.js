const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const source=readFileSync(`${__dirname}/../build/extension/modules/page-queue.js`,'utf8');
const url='https://paine.airlinesim.aero/app/com/inventory/AAABBB';
function queue(random=0.5) {
    let now=100000, nextTab=100, failWrite=false, failCreate=false, initialStatus='loading';
    const notices=[],editErrors=[],attempts=[];
    const edit=kind=>{attempts.push({kind,time:now});if(editErrors.length)throw Error(editErrors.shift());};
    const saved={}, tabs=new Map([[1,{id:1,status:'complete'}],[2,{id:2,status:'complete'}]]), opened=[];
    let listeners;
    const clone=x=>JSON.parse(JSON.stringify(x));
    function boot() {
        listeners={};
        const chrome={runtime:{id:'aes',onMessage:{addListener:f=>listeners.message=f}},
            storage:{session:{get:async()=>clone(saved),set:async x=>{if(failWrite)throw Error('storage failed');Object.assign(saved,clone(x));}}},
            tabs:{sendMessage:async(tab,message,options)=>{notices.push({tab,message,options});},create:async options=>{edit('open');if(failCreate)throw Error('create failed');const tab={id:nextTab++,status:initialStatus};tabs.set(tab.id,tab);opened.push({...options,time:now,id:tab.id});return tab;},
                update:async(id,options)=>{edit('navigate');const tab=tabs.get(id);if(!tab)throw Error('closed');tab.status=initialStatus;opened.push({...options,time:now,id});return tab;},
                get:async id=>{if(!tabs.has(id))throw Error('closed');return tabs.get(id);},
                onUpdated:{addListener:f=>listeners.updated=f},onRemoved:{addListener:f=>listeners.removed=f}}};
        runInNewContext(source,{chrome,URL,Date:{now:()=>now},Math:{random:()=>random,floor:Math.floor,max:Math.max,min:Math.min},console});
    }
    boot();
    function message(op,id,kind='open',tab=1,destination=url,doc='doc'+tab,sourceUrl=url,delay) {
        return new Promise(resolve=>listeners.message({type:'AES_PAGE_QUEUE',op,id,kind,url:destination,delay},{id:'aes',tab:{id:tab},documentId:doc,frameId:0,url:sourceUrl},resolve));
    }
    return {message,notices,opened,saved,tabs,boot,attempts,editErrors,advance:ms=>now+=ms,failWrite:()=>failWrite=true,failCreate:()=>failCreate=true,initialStatus:status=>initialStatus=status,
        updated:(id,status)=>{tabs.get(id).status=status;listeners.updated(id,{status});},closed:id=>{tabs.delete(id);listeners.removed(id);}};
}

const dragging='Tabs cannot be edited right now (user may be dragging a tab).';
const read='https://paine.airlinesim.aero/action/info/flight?id=1';
const staff='https://paine.airlinesim.aero/action/enterprise/staffOverview';
const salary=(q,op,id)=>q.message(op,id,'salary',1,staff,'doc1',staff);
// Occupy four real permits when exercising the lifecycle of the final slot.
const occupyFour=async q=>{
    for(let i=0;i<4;i++){
        await q.message('enqueue','held'+i,'read',10+i,read);
        assert.equal((await q.message('poll','held'+i,'read',10+i,read)).state,'running');
        q.advance(65);
    }
};
const settle=async(q,id)=>{q.updated(id,'complete');await q.message('poll','a');};

for(const kind of ['open','navigate'])test(`${kind} waits through tab dragging and page loading across worker restarts`,async()=>{
    const q=queue(0);await occupyFour(q);q.editErrors.push(dragging,dragging);
    assert.equal((await q.message('enqueue','a',kind)).state,'queued');
    assert.equal(q.notices.at(-1).message.notBefore,100360);
    await q.message('enqueue','b','open',2);q.boot();
    q.advance(100);assert.equal((await q.message('poll','a',kind)).state,'queued');
    q.advance(200);assert.equal((await q.message('poll','a',kind)).state,'done');
    q.advance(1000);await q.message('poll','b','open',2);assert.equal(q.opened.length,1);
    await settle(q,kind==='open'?100:1);
    q.advance(54);await q.message('poll','b','open',2);assert.equal(q.opened.length,1);
    q.advance(1);assert.equal((await q.message('poll','b','open',2)).state,'done');
    assert.deepEqual(q.opened.map(t=>t.id),kind==='open'?[100,101]:[1,100]);
    await q.message('poll','a',kind);assert.equal(q.opened.length,2);
});

for(const cancel of ['cancel','navigate','close'])test(`waiting tab-drag operation is cancelled on ${cancel}`,async()=>{
    const q=queue();q.editErrors.push(dragging);await q.message('enqueue','a');
    if(cancel==='cancel')await q.message('cancel','a');else if(cancel==='navigate')q.updated(1,'loading');else q.closed(1);
    q.advance(1000);assert.equal((await q.message('poll','a')).ok,false);
    assert.equal(q.attempts.length,1);assert.equal(q.opened.length,0);
});

test('persistent tab drag expires without replaying and a late recovered drag succeeds',async()=>{
    const q=queue(0);q.editErrors.push(dragging,dragging);
    await q.message('enqueue','a');await q.message('enqueue','b','open',2);
    q.advance(30000);q.boot();assert.equal((await q.message('poll','a')).ok,false);
    q.advance(1000);assert.equal((await q.message('poll','b','open',2)).state,'done');
    const late=queue(0);late.editErrors.push(dragging);await late.message('enqueue','a');late.advance(60000);late.boot();
    assert.equal((await late.message('poll','a')).state,'done');assert.equal(late.opened.length,1);
});

for(const kind of ['open','navigate'])test(`${kind} waits for completion plus a randomized 55–65 ms gap`,async()=>{
    for(const random of [0,0.5,0.999999]) {
        const q=queue(random),gap=55+Math.floor(random*11);await occupyFour(q);
        await q.message('enqueue','a',kind);await q.message('enqueue','b','open',2);
        q.advance(2000);await q.message('poll','b','open',2);assert.equal(q.opened.length,1,'loading page holds queue');
        await settle(q,kind==='open'?100:1);
        q.advance(gap-1);await q.message('poll','b','open',2);assert.equal(q.opened.length,1);
        q.advance(1);await q.message('poll','b','open',2);assert.equal(q.opened.length,2);
        assert.equal(q.opened[1].time-q.opened[0].time,2000+gap);
    }
});

test('price dispatch acknowledgement holds the slot until navigation completes',async()=>{
    const q=queue(0);await occupyFour(q);await q.message('enqueue','p','price');await q.message('poll','p','price');
    await q.message('complete','p','price');await q.message('enqueue','other','open',2);
    q.advance(2000);assert.equal((await q.message('poll','other','open',2)).state,'queued','old complete tab state is not a POST acknowledgement');
    q.updated(1,'loading');await q.message('poll','other','open',2);q.boot();
    q.advance(2000);assert.equal((await q.message('poll','other','open',2)).state,'queued');
    q.updated(1,'complete');await q.message('poll','other','open',2);
    q.advance(54);assert.equal((await q.message('poll','other','open',2)).state,'queued');
    q.advance(1);assert.equal((await q.message('poll','other','open',2)).state,'done');
});

test('price navigation without an explicit completion releases after load and gap',async()=>{
    const q=queue(0);await occupyFour(q);await q.message('enqueue','p','price');await q.message('poll','p','price');
    q.updated(1,'loading');await q.message('enqueue','other','open',2);
    q.advance(2000);assert.equal(q.opened.length,0);
    q.updated(1,'complete');await q.message('poll','other','open',2);
    q.advance(1000);assert.equal((await q.message('poll','other','open',2)).state,'done');
});

test('worker restart recovers missed load completion without replaying tabs',async()=>{
    const q=queue(0);await occupyFour(q);await q.message('enqueue','a');await q.message('enqueue','b','open',2);
    q.advance(2000);q.tabs.get(100).status='complete';q.boot();
    await q.message('poll','b','open',2);assert.equal(q.opened.length,1);
    q.advance(1000);await q.message('poll','b','open',2);assert.equal(q.opened.length,2);
    assert.equal((await q.message('enqueue','a')).state,'done');assert.equal(q.opened.length,2);
});

test('closed targets release loading slots and navigated sources cancel waiting requests',async()=>{
    const q=queue(0);await q.message('enqueue','a');await q.message('enqueue','b','open',2);
    q.updated(2,'loading');assert.equal((await q.message('poll','b','open',2)).ok,false);
    q.closed(100);await q.message('enqueue','c','open',1);q.advance(1000);
    assert.equal((await q.message('poll','c')).state,'done');
});

test('unsupported URLs and another document cannot claim a queue request',async()=>{
    const q=queue();
    for(const bad of ['https://evil.test/app/com/inventory/X','http://paine.airlinesim.aero/app/com/inventory/X','https://paine.airlinesim.aero/app/fleets','https://other.airlinesim.aero/app/com/inventory/X'])assert.equal((await q.message('enqueue',bad,'open',1,bad)).ok,false);
    await q.message('enqueue','p','price');assert.equal((await q.message('poll','p','price',1,url,'different')).ok,false);
    assert.equal(q.opened.length,0);
});
for(const failure of ['storage','creation'])test(`${failure} failure prevents creation/replay`,async()=>{
    const q=queue();if(failure==='storage')q.failWrite();else q.failCreate();
    assert.equal((await q.message('enqueue','a')).ok,false);q.boot();assert.equal((await q.message('poll','a')).ok,false);assert.equal(q.opened.length,0);
});

test('request completion notifies the exact next document and preserves the gap',async()=>{
    const q=queue(0);await occupyFour(q);await q.message('enqueue','a','read',1,read);await q.message('poll','a','read',1,read);
    await q.message('enqueue','b','price',2);
    const before=q.notices.filter(n=>n.message.id==='b').at(-1);assert.equal(before.options.documentId,'doc2');assert.equal(before.tab,2);
    await q.message('complete','a','read',1,read);
    assert.ok(q.notices.filter(n=>n.message.id==='b').at(-1).message.notBefore<before.message.notBefore);
    q.advance(54);assert.equal((await q.message('poll','b','price',2)).state,'queued');
    q.advance(1);assert.equal((await q.message('poll','b','price',2)).state,'running');
});

test('abandoned waiting client expires and another page cannot grant a request permit',async()=>{
    const q=queue();await q.message('enqueue','p','price');await q.message('enqueue','b','open',2);
    assert.equal(q.saved.aesPageQueueV1.jobs[0].state,'queued');assert.equal(q.opened.length,0);
    q.advance(120001);assert.equal((await q.message('enqueue','c','open',2)).state,'done');
});

test('simultaneous enqueues preserve the dispatch gap',async()=>{
    const q=queue();await Promise.all([q.message('enqueue','a'),q.message('enqueue','b','open',2)]);
    assert.equal(q.opened.length,1);assert.equal(q.saved.aesPageQueueV1.jobs.filter(j=>j.state==='queued').length,1);
});

test('five tabs load concurrently; any completed slot admits the next FIFO job across restarts',async()=>{
    const q=queue(0);
    for(let i=0;i<7;i++) {
        await q.message('enqueue','tab'+i);q.advance(55);
    }
    assert.equal(q.opened.length,5);
    assert.equal(q.saved.aesPageQueueV1.jobs.filter(j=>j.loading).length,5);
    q.boot();await q.message('poll','tab5');assert.equal(q.opened.length,5);
    // A later job can release capacity even while the first tab is still loading.
    q.updated(103,'complete');await q.message('poll','tab5');
    q.advance(54);await q.message('poll','tab5');assert.equal(q.opened.length,5);
    q.advance(1);assert.equal((await q.message('poll','tab5')).state,'done');
    assert.equal(q.opened.length,6);
    assert.equal(q.saved.aesPageQueueV1.jobs.find(j=>j.id==='tab6').state,'queued');
    q.closed(101);await q.message('poll','tab6');q.advance(55);
    assert.equal((await q.message('poll','tab6')).state,'done');
    assert.equal(q.opened.length,7);
});

test('mixed requests share five slots and a source alone can claim its request',async()=>{
    const q=queue(0);await occupyFour(q);
    await q.message('enqueue','price','price');await q.message('enqueue','next','open',2);
    assert.equal(q.opened.length,0);
    assert.equal((await q.message('poll','price','price')).state,'running');
    q.advance(1000);await q.message('poll','next','open',2);assert.equal(q.opened.length,0);
    await q.message('complete','held2','read',12,read);q.advance(55);
    assert.equal((await q.message('poll','next','open',2)).state,'done');
    assert.equal(q.saved.aesPageQueueV1.jobs.filter(j=>j.state==='running'||j.loading).length,5);
});

test('requests on one tab remain serialized while other slots are available',async()=>{
    const q=queue(0);await q.message('enqueue','read1','read',1,read);await q.message('poll','read1','read',1,read);
    q.advance(55);await q.message('enqueue','read2','read',1,read);
    assert.equal((await q.message('poll','read2','read',1,read)).state,'queued');
    await q.message('complete','read1','read',1,read);q.advance(55);
    assert.equal((await q.message('poll','read2','read',1,read)).state,'running');
});

test('a later expired permit is recovered even when an earlier tab is still loading',async()=>{
    const q=queue(0);await q.message('enqueue','slow');q.advance(55);
    await q.message('enqueue','expired','read',2,read);await q.message('poll','expired','read',2,read);
    q.advance(30000);q.boot();await q.message('enqueue','next');
    assert.equal(q.saved.aesPageQueueV1.jobs.find(j=>j.id==='expired').state,'failed');
    assert.equal(q.opened.length,1);
    q.advance(60000);assert.equal((await q.message('poll','next')).state,'done');
    assert.equal(q.opened.length,2);
});

test('unknown dispatch outcome and stuck loads pause before continuing, never replay',async()=>{
    for(const unknown of [true,false]){
        const q=queue(0);await q.message('enqueue','a');
        if(unknown){delete q.saved.aesPageQueueV1.jobs[0].target;q.saved.aesPageQueueV1.jobs[0].state='running';}
        q.advance(120000);q.boot();await q.message('enqueue','b','open',2);assert.equal(q.opened.length,1);
        q.advance(59999);await q.message('poll','b','open',2);assert.equal(q.opened.length,1);
        q.advance(1);await q.message('poll','b','open',2);assert.equal(q.opened.length,2);
        assert.equal(q.opened.filter(t=>t.id===100).length,1);
    }
});

for(const kind of ['read','salary'])test(`${kind} holds the fifth slot until response completion across restarts`,async()=>{
    for (const random of [0,0.5,0.999999]){
        const q=queue(random),gap=55+Math.floor(random*11);await occupyFour(q);
        const request=op=>kind==='salary'?salary(q,op,'a'):q.message(op,'a','read',1,read);
        await request('enqueue');assert.equal((await request('poll')).state,'running');
        await q.message('enqueue','b','open',2);q.advance(2000);q.boot();
        assert.equal((await q.message('poll','b','open',2)).state,'queued');
        await request('complete');q.advance(gap-1);assert.equal((await q.message('poll','b','open',2)).state,'queued');
        q.advance(1);assert.equal((await q.message('poll','b','open',2)).state,'done');
    }
});

test('read and salary permissions remain limited to explicit destinations',async()=>{
    const q=queue();
    for(const dest of ['https://paine.airlinesim.aero/app/info/airports/1-1.ILinkListener-link.station~open','https://paine.airlinesim.aero/app/info/enterprises/99?tab=3&select=99',staff])assert.equal((await q.message('enqueue',dest,'read',1,dest)).ok,false);
    assert.equal((await q.message('enqueue','bad','salary',1,staff)).ok,false);
});

for(const kind of ['price','read','salary'])test(`cancelled ${kind} permit releases after the shared gap`,async()=>{
    const q=queue(0),request=op=>kind==='salary'?salary(q,op,'a'):q.message(op,'a',kind,1,kind==='read'?read:url);
    await request('enqueue');await request('poll');await q.message('enqueue','b','open',2);await request('cancel');
    q.advance(54);assert.equal((await q.message('poll','b','open',2)).state,'queued');
    q.advance(1);assert.equal((await q.message('poll','b','open',2)).state,'done');
});

test('error pages pause every tab, persist across restarts and back off on repeated errors',async()=>{
    const q=queue(0);await q.message('cooldown','error');
    await q.message('enqueue','b','open',2);q.boot();
    q.advance(59999);assert.equal((await q.message('poll','b','open',2)).state,'queued');
    q.advance(1);assert.equal((await q.message('poll','b','open',2)).state,'done');
    await settle(q,100);await q.message('cooldown','error2');
    assert.equal(q.saved.aesPageQueueV1.next,280000);
    q.advance(600000);await q.message('cooldown','error3');assert.equal(q.saved.aesPageQueueV1.backoff,60000);
});

test('cooldown honors Retry-After and completion/cancellation cannot shorten it',async()=>{
    const q=queue(0);await q.message('enqueue','a','read',1,read);await q.message('poll','a','read',1,read);
    await q.message('cooldown','error','open',1,url,'doc1',url,180000);
    await q.message('cancel','a','read',1,read);assert.equal(q.saved.aesPageQueueV1.next,280000);
    q.advance(179000);await q.message('enqueue','b','open',2);
    assert.equal(q.opened.length,0);q.boot();q.advance(1000);
    assert.equal((await q.message('poll','b','open',2)).state,'done');
});

for(const kind of ['open','navigate'])test(`${kind} cannot treat the tab API old complete state as a finished navigation`,async()=>{
    const q=queue(0);await occupyFour(q);q.initialStatus('complete');
    await q.message('enqueue','a',kind);await q.message('enqueue','b','open',2);
    q.advance(2000);await q.message('poll','b','open',2);assert.equal(q.opened.length,1);
    q.updated(kind==='open'?100:1,'loading');await q.message('poll','b','open',2);
    q.updated(kind==='open'?100:1,'complete');await q.message('poll','b','open',2);
    q.advance(1000);await q.message('poll','b','open',2);assert.equal(q.opened.length,2);
});
