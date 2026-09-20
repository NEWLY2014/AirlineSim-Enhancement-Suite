const assert=require('node:assert/strict');
function mockPlannerServer(t,p) {
    const subscribers = new Map();
    p.w.Wicket = {Event:{subscribe(topic, handler){
        const handlers=subscribers.get(topic)||[];handlers.push(handler);subscribers.set(topic,handlers);
    }}};
    const publish=(phase,attrs)=>(subscribers.get('/ajax/call/'+phase)||[]).forEach(fn=>fn({},attrs));
    p.load('modules/planner-events.js');
    let controlId=0;
    const identify=()=>p.w.document?.querySelectorAll('form input,form select,form a').forEach(el=>{el.id ||= 'planner-control-'+(++controlId)});
    identify();
    const observer=new p.w.MutationObserver(identify);observer.observe(p.w.document.body,{childList:true,subtree:true});
    t.after(()=>observer.disconnect());
    p.serverDelay=30;p.serverDoneDelay=0;p.serverResponds=true;p.serverFails=false;p.pendingUpdates=0;p.maxPendingUpdates=0;
    const update=event=>{
        const el=event.target;
        if(!((event.type==='click' && (/days:daySelection:|fixedArrivalSelection:/.test(el.name||'') || /daySelection.none|toggle~existing/.test(el.href||''))) ||
             (event.type==='change' && /newArrivals:/.test(el.name||''))))return;
        const attrs={c:el.id};publish('init',attrs);
        p.pendingUpdates++;p.maxPendingUpdates=Math.max(p.maxPendingUpdates,p.pendingUpdates);
        if(!p.serverResponds)return;
        p.w.setTimeout(()=>{
            publish(p.serverFails?'failure':'success',attrs);
            const done=()=>{p.pendingUpdates--;publish('done',attrs)};
            if(p.serverDoneDelay)p.w.setTimeout(done,p.serverDoneDelay);else done();
        },p.serverDelay);
    };
    p.w.document.addEventListener('click',update,true);
    p.w.document.addEventListener('change',update,true);
}
async function waitForPlanner(check) {
    const deadline=Date.now()+15000;
    while(Date.now()<deadline){if(check())return;await new Promise(resolve=>setTimeout(resolve,20));}
    assert.ok(check(),'Planner did not reach the expected state');
}
module.exports = {mockPlannerServer,waitForPlanner};
