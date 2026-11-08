import type { VMValue } from './support/fixtures.cts';
const {test}=(require('node:test') as typeof import('node:test'));
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const {browser,until}=(require('./support/browser.cts') as import('./support/browser.cts').API);
const {notify}=(require('./support/coordinator.cts') as import('./support/coordinator.cts').API);

test('queued client sleeps until a notification instead of repeatedly polling',async t=>{
    const p=browser(t);let id,ready=false,polls=0;
    p.w.chrome.runtime.sendMessage=(message,reply)=>{
        id=message.id;if(message.op==='poll')polls++;
        reply({ok:true,state:ready?'running':'queued',expires:Date.now()+10000});
    };
    const waiting=p.run("AES.queuePage(location.href,'read')");
    await until(()=>polls===1);
    await new Promise(resolve=>setTimeout(resolve,180));assert.equal(polls,1);
    ready=true;notify(p.w.chrome,{type:'AES_PAGE_QUEUE_READY',id,notBefore:Date.now()+30});
    const permit=await waiting;assert.equal(polls,2);assert.ok(permit.expires>Date.now());
});

test('missed queue notification recovers from persisted state with a bounded fallback',async t=>{
    const p=browser(t);let polls=0;
    const timeout=p.w.setTimeout.bind(p.w);
    p.w.setTimeout=(fn: (...args: VMValue[]) => VMValue,ms: number = 0,...args: VMValue[])=>timeout(fn,ms===60000?30:ms,...args);
    p.w.chrome.runtime.sendMessage=(message: { op: string; },reply: (arg0: { ok: boolean; state: string; expires: number; }) => void)=>{
        if(message.op==='poll')polls++;
        reply({ok:true,state:polls>=2?'running':'queued',expires:Date.now()+10000});
    };
    const permit=await p.run("AES.queuePage(location.href,'read')");
    assert.equal(polls,2);assert.ok(permit.expires>Date.now());
});

test('ready queue notification dispatches even when background timers cannot run',async t=>{
    const p=browser(t);let id,ready=false,polls=0;
    p.w.setTimeout=()=>1;
    p.w.chrome.runtime.sendMessage=(message,reply)=>{
        id=message.id;if(message.op==='poll')polls++;
        reply({ok:true,state:ready?'running':'queued',expires:Date.now()+10000});
    };
    const waiting=p.run("AES.queuePage(location.href,'read')");
    await until(()=>polls===1);
    ready=true;notify(p.w.chrome,{type:'AES_PAGE_QUEUE_READY',id,notBefore:Date.now()});
    const permit=await waiting;assert.equal(polls,2);assert.ok(permit.expires>Date.now());
});

test('a long cooldown keeps the waiting lease alive with bounded recovery checks',async t=>{
    const p=browser(t);let polls=0;
    const timeout=p.w.setTimeout.bind(p.w);
    p.w.setTimeout=(fn: (...args: VMValue[]) => VMValue,ms: number = 0,...args: VMValue[])=>timeout(fn,ms===60000?10:ms,...args);
    p.w.chrome.runtime.sendMessage=(message: { op: string; },reply: (arg0: { ok: boolean; state: string; expires: number; notBefore: number; }) => void)=>{
        if(message.op==='poll')polls++;
        reply({ok:true,state:polls>=3?'running':'queued',expires:Date.now()+30000,notBefore:Date.now()+900000});
    };
    const permit=await p.run("AES.queuePage(location.href,'salary')");
    assert.equal(polls,3);assert.ok(permit.expires>Date.now());
});
