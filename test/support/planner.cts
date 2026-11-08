import type { BrowserPage,Cleanup,PlannerState,VMValue } from './fixtures.cts';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
function mockPlannerServer(t: Cleanup,p: BrowserPage): BrowserPage & PlannerState {
    const subscribers = new Map<string, ((event: object, attrs: {c: string}) => void)[]>();
    p.w.Wicket = {Event:{subscribe(topic: string, handler: (...args: VMValue[]) => VMValue){
        const handlers=subscribers.get(topic)||[];handlers.push(handler);subscribers.set(topic,handlers);
    }}};
    const publish=(phase: string,attrs: VMValue)=>(subscribers.get('/ajax/call/'+phase)||[]).forEach((fn: (...args: VMValue[]) => VMValue)=>fn({},attrs));
    p.load('modules/planner-events.js');
    let controlId=0;
    const identify=()=>p.w.document?.querySelectorAll<HTMLElement>('form input,form select,form a').forEach((el: { id: string; })=>{el.id ||= 'planner-control-'+(++controlId)});
    identify();
    const observer=new p.w.MutationObserver(identify);observer.observe(p.w.document.body,{childList:true,subtree:true});
    t.after(()=>observer.disconnect());
    const state = Object.assign(p, {serverDelay:30,serverDoneDelay:0,serverResponds:true,serverFails:false,pendingUpdates:0,maxPendingUpdates:0});
    const update=(event: Event)=>{
        const el=event.target as HTMLInputElement | HTMLSelectElement | HTMLAnchorElement | null;
        if (!(el instanceof p.w.HTMLInputElement || el instanceof p.w.HTMLSelectElement || el instanceof p.w.HTMLAnchorElement)) return;
        if(!((event.type==='click' && (/days:daySelection:|fixedArrivalSelection:/.test(('name' in el ? el.name : '')) || /daySelection.none|toggle~existing/.test(('href' in el ? el.href : '')))) ||
             (event.type==='change' && /newArrivals:/.test(('name' in el ? el.name : '')))))return;
        const attrs={c:el.id};publish('init',attrs);
        state.pendingUpdates++;state.maxPendingUpdates=Math.max(state.maxPendingUpdates,state.pendingUpdates);
        if(!state.serverResponds)return;
        p.w.setTimeout(()=>{
            publish(state.serverFails?'failure':'success',attrs);
            const done=()=>{state.pendingUpdates--;publish('done',attrs)};
            if(state.serverDoneDelay)p.w.setTimeout(done,state.serverDoneDelay);else done();
        },state.serverDelay);
    };
    p.w.document.addEventListener('click',update,true);
    p.w.document.addEventListener('change',update,true);
    return state;
}
async function waitForPlanner(check: () => unknown) {
    const deadline=Date.now()+15000;
    while(Date.now()<deadline){if(check())return;await new Promise(resolve=>setTimeout(resolve,20));}
    assert.ok(check(),'Planner did not reach the expected state');
}
const api = {mockPlannerServer,waitForPlanner};

export type API = typeof api;
module.exports = api;
