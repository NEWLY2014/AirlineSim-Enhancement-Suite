import type { VMValue } from './support/fixtures.cts';
const fs=(require('node:fs') as typeof import('node:fs')),vm=(require('node:vm') as typeof import('node:vm')),assert: typeof import('node:assert/strict') = require('node:assert/strict');
const {test}=(require('node:test') as typeof import('node:test'));
const source=fs.readFileSync(`${__dirname}/../build/extension/content_personnelManagement.js`,'utf8');
const start=source.indexOf('async function submitSalaryChanges('),end=source.indexOf('function salaryStatus(',start);
const code=source.slice(start,end);
async function check(fail: boolean){
 let active=0,max=0,started=0,done=0,last='';const releases: VMValue[]=[];
 const buttons=Array.from({length:6},()=>{const form={isConnected:true,getAttribute:(k: string)=>k==='method'?'post':null};return {0:{getAttribute:()=>null},closest:()=>[form]};});
 const context: Record<string, VMValue>={URL,URLSearchParams,Set,Promise,Date,Error,String,AbortController,FormData:class { *[Symbol.iterator](){yield ['amount','1000'];}},DOMParser:class{parseFromString(){return {}; }},location:{href:'https://paine.airlinesim.aero/action/enterprise/staffOverview',origin:'https://paine.airlinesim.aero'},document:{baseURI:'https://paine.airlinesim.aero/action/enterprise/staffOverview'},window:{setTimeout,clearTimeout},submittedSalaryForms:new WeakSet(),AESRead:{context:()=>()=>true},AESI18n:{t:(s: string,p: Record<string,string>={})=>s.replace(/\{(\d)\}/g,(_,i)=>p[i])},salaryStatus:(s: string)=>last=s,AES:{queuePage:async()=>({expires:Date.now()+30000,complete:async()=>{},cancel:async()=>{}}),checkServerResponse:async (r: VMValue)=>{if(r.bad)throw Error('failure');}},fetch:()=>{started++;active++;max=Math.max(max,active);return new Promise(resolve=>releases.push((bad: VMValue)=>{active--;done++;resolve({bad,text:async()=>''});}));}};
 vm.createContext(context);vm.runInContext(code+';globalThis.submit=submitSalaryChanges',context);
 const result=context.submit(buttons).then((value: VMValue)=>({value}),(error: VMValue)=>({error}));
 const flush=()=>new Promise(r=>setImmediate(r));await flush();assert.equal(started,5);assert.equal(last,'Updating salaries: 0/6 completed.');
 releases.shift()(fail);await flush();
 if(fail){assert.equal(started,5);releases.splice(0).forEach(r=>r(false));const out=await result;assert.match(out.error.message,/stopped: 4\/6/);}
 else{while(done<6){releases.splice(0).forEach(r=>r(false));await flush();}assert.equal((await result).value,6);assert.equal(last,'Updating salaries: 6/6 completed.');}
 assert.equal(max,5);
}
test('compiled salary batch bounds concurrency and reports response completion',()=>check(false));
test('compiled salary batch drains active requests and stops after partial failure',()=>check(true));
