import type { VMValue } from './support/fixtures.cts';
const {test} = require('node:test') as typeof import('node:test');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const {readFileSync,readdirSync} = require('node:fs') as typeof import('node:fs');
const {join} = require('node:path') as typeof import('node:path');
const {browser,until} = require('./support/browser.cts') as import('./support/browser.cts').API;
const {sender,coordinator} = require('./support/coordinator.cts') as import('./support/coordinator.cts').API;
const options = {id:'aes-test',url:'chrome-extension://aes-test/options.html'};
const call = (dispatch: VMValue,who: VMValue,message: VMValue) => new Promise<VMValue>(resolve=>dispatch(message,who,resolve));
const request = (op: string,data?: VMValue) => ({type:'AES_OPTIONS_STORAGE',op,data});

test('local storage has one background mutation boundary and no page can close itself directly',()=>{
    function scan(dir: string) {
        for(const file of readdirSync(dir,{withFileTypes:true})) {
            const path=join(dir,file.name);
            if(file.isDirectory()) scan(path);
            else if(file.name.endsWith('.ts')) {
                const source=readFileSync(path,'utf8');
                if(file.name!=='storage-coordinator.ts') assert.doesNotMatch(source,/chrome\.storage\.local\.(set|remove|clear)\s*\(/,path);
                assert.doesNotMatch(source,/window\.close\s*\(/,path);
            }
        }
    }
    scan('extension');
});

test('concurrent log appends retain every entry and cap the daily history',async t=>{
    const key='aesLog_20261117',p=browser(t,{data:{[key]:{entries:Array.from({length:299},(_,n)=>({message:String(n)}))}}});
    const replies=await Promise.all(Array.from({length:12},(_,n)=>call(p.dispatch,sender('https://paine.airlinesim.aero/app/enterprise/dashboard'),
        {type:'AES_APPEND_LOG',key,entry:{time:'2026-11-17',message:'new-'+n}})));
    assert.ok(replies.every(reply=>reply.ok));assert.equal(p.saved[key].entries.length,300);
    assert.deepEqual(p.saved[key].entries.slice(-12).map((v: VMValue)=>v.message),Array.from({length:12},(_,n)=>'new-'+n));
});

test('replacement is one transaction: log append waits until verification and cleanup finish',async t=>{
    const p=browser(t,{data:{old:{keep:true}}}),original=p.w.chrome.storage.local.set;
    let finish: (()=>void) | undefined;
    p.w.chrome.storage.local.set=(values,callback)=>{
        if(values.replacement) {finish=()=>original(values,callback);return;}
        return original(values,callback);
    };
    const restore=call(p.dispatch,options,request('replace',{replacement:{value:1}}));
    await until(()=>finish);
    const log=call(p.dispatch,sender('https://paine.airlinesim.aero/app/info/ors'),{type:'AES_APPEND_LOG',key:'aesLog_20261117',entry:{message:'after'}});
    assert.equal(p.saved.aesLog_20261117,undefined);assert.deepEqual(p.saved.aesRestoreRecoveryV1.previous,{old:{keep:true}});
    finish!();assert.equal((await restore).ok,true);assert.equal((await log).ok,true);
    assert.deepEqual(Object.keys(p.saved).sort(),['aesLog_20261117','replacement']);
});

test('interrupted replacement blocks page writes across worker restarts until recovery succeeds',async t=>{
    const previous={settings:{keep:true},history:{data:[1,2]}},p=browser(t,{data:previous});
    p.failures.remove='Interrupted cleanup';
    assert.equal((await call(p.dispatch,options,request('replace',{settings:{keep:false}}))).ok,false);
    assert.deepEqual(p.saved.aesRestoreRecoveryV1.previous,previous);
    const restarted=coordinator(p.w.chrome),who=sender('https://paine.airlinesim.aero/app/enterprise/settings');
    const blocked=await call(restarted,who,{type:'AES_STORAGE_MUTATE',op:'set',values:{aesLanguage:'ja'}});
    assert.equal(blocked.ok,false);assert.match(blocked.error,/Recover/);assert.equal(p.saved.aesLanguage,undefined);
    assert.equal((await call(restarted,options,request('merge',{x:1}))).ok,false);
    delete p.failures.remove;
    assert.equal((await call(restarted,options,request('recover'))).ok,true);
    assert.deepEqual(p.saved,previous);
    assert.equal((await call(restarted,who,{type:'AES_STORAGE_MUTATE',op:'set',values:{aesLanguage:'ja'}})).ok,true);
});

test('restore rejects reserved recovery keys in both modes and unauthorized callers cannot erase data',async t=>{
    const p=browser(t,{data:{keep:1}}),game=sender('https://paine.airlinesim.aero/app/enterprise/settings');
    for(const op of ['merge','replace']) assert.equal((await call(p.dispatch,options,request(op,{aesRestoreRecoveryV1:{previous:{}}}))).ok,false);
    for(const who of [game,{...options,id:'foreign'},{...options,url:'chrome-extension://aes-test/other.html'}]) {
        assert.equal((await call(p.dispatch,who,request('clear'))).ok,false);
    }
    for(const values of [{settings:{}},{paine42flightPlanTemplate:{}},{aesRestoreRecoveryV1:{}}]) {
        assert.equal((await call(p.dispatch,game,{type:'AES_STORAGE_MUTATE',op:'set',values})).ok,false);
    }
    assert.deepEqual(p.saved,{keep:1});
});

test('clear logs uses current background state and retains unrelated records',async t=>{
    const p=browser(t,{data:{keep:1,aesLog_20261116:{entries:[]},custom:{type:'log'}}});
    p.saved.aesLog_20261117={entries:[{}]};
    assert.equal((await call(p.dispatch,options,request('clearLogs'))).ok,true);
    assert.deepEqual(p.saved,{keep:1});
});
