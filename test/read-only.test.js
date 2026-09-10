const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser,until}=require('./support/browser.cjs');
const {frontend,financial,enterprise,respond,install}=require('./support/read-pages.cjs');
const html=frontend()+'<div id="header"><div><button aria-haspopup="menu"><span class="_name_test">AES Airlines</span></button><div role="menubar"></div></div></div>';
const page=t=>browser(t,{html,path:'/app/enterprise/dashboard'});

test('read-only collection uses same-origin GET without opening tabs or running response scripts',async t=>{
    const p=page(t),requests=install(p);let opened=0;p.w.open=()=>opened++;
    const send=p.w.chrome.runtime.sendMessage,messages=[];
    p.w.chrome.runtime.sendMessage=(m,cb)=>{messages.push(m);return send(m,cb);};
    const doc=await p.run("AESRead.fetchDocument('/action/info/flight?id=1')");
    assert.ok(doc.querySelector('#privInf'));assert.equal(requests.length,1);
    assert.equal(requests[0].options.method,'GET');assert.equal(requests[0].options.credentials,'same-origin');
    assert.equal(messages[0].kind,'read');assert.ok(messages.some(m=>m.op==='complete'));assert.equal(opened,0);
    p.w.fetch=async url=>respond(url,financial()+'<script>window.executed=true</script>');
    await p.run("AESRead.fetchDocument('/action/info/flight?id=1')");assert.equal(p.w.executed,undefined);
});
test('unsupported or mutating URLs are rejected before any request',async t=>{
    const p=page(t),requests=install(p);
    for(const url of ['https://other.airlinesim.aero/action/info/flight?id=1','/action/enterprise/staffOverview','/app/info/enterprises/99?tab=3&select=99','/app/info/airports/99-1.ILinkListener-link.station~open']){
        p.w.input=url;await assert.rejects(p.run('AESRead.fetchDocument(window.input)'),/Unsupported/);
    }
    assert.equal(requests.length,0);
});
test('HTTP errors, login responses, wrong airline, wrong tab and redirected targets release the read slot',async t=>{
    const p=page(t),send=p.w.chrome.runtime.sendMessage;let cancels=0;
    p.w.chrome.runtime.sendMessage=(m,cb)=>{if(m.op==='cancel')cancels++;return send(m,cb);};
    for(const response of [
        {ok:false,status:503},respond('https://paine.airlinesim.aero/login','Login'),
        respond('https://paine.airlinesim.aero/app/info/enterprises/99?tab=3','<form><input type="password"></form>'),
        respond('https://paine.airlinesim.aero/app/info/enterprises/99?tab=3',enterprise('3').replace('"fixedEnterpriseId":42','"fixedEnterpriseId":43')),
        respond('https://paine.airlinesim.aero/app/info/enterprises/99?tab=3',enterprise('2'))]){
        p.w.fetch=async()=>response;await assert.rejects(p.run("AESRead.fetchDocument('/app/info/enterprises/99?tab=3')"));
    }
    assert.equal(cancels,5);assert.deepEqual(p.saved,{});
});
test('ownership loss aborts an in-flight read and cannot save its result',async t=>{
    const p=page(t);let started=false;
    p.w.fetch=(url,options)=>new Promise((resolve,reject)=>{started=true;options.signal.addEventListener('abort',()=>reject(new Error('aborted')));});
    const result=p.run("AESRead.fetchDocument('/action/info/flight?id=1')");
    const rejected=assert.rejects(result,/aborted/);
    await until(()=>started);p.run('AES.isPageOwner=()=>false');await rejected;assert.deepEqual(p.saved,{});
});
test('financial parser rejects incomplete and non-private pages rather than replacing old profits',async t=>{
    const p=page(t);
    for(const bad of [financial().replace('id="privInf"','id="public"'),financial().replace(/<tr class="cm">.*?<\/tr>/,''),financial().replace('<td>100</td>','<td>unknown</td>')]){
        p.w.content=bad;assert.throws(()=>p.run("AESRead.flight(new DOMParser().parseFromString(window.content,'text/html'),1)"));
    }
});
test('competitor refresh preserves existing metadata and same-week history',async t=>{
    const p=page(t);install(p);const key='paine42_99competitorMonitoring';
    p.saved[key]={key,type:'competitorMonitoring',id:'99',ownerId:'42',tracking:1,extra:'keep',tab0:{20260901:{keep:true}},tab2:{20260907:{week:362026,keep:true}}};
    await p.run("AESRead.collectCompetitor({id:'99',name:'Other',displayName:'Other',code:'OA'},()=>{})");
    assert.equal(p.saved[key].extra,'keep');assert.equal(p.saved[key].tracking,1);assert.equal(p.saved[key].tab0['20260901'].keep,true);
    assert.equal(p.saved[key].tab0['20260908'].pax,1000);assert.deepEqual(p.saved[key].tab2,{20260907:{week:362026,keep:true}});
    assert.ok(p.saved.paine99schedule);
});
test('incomplete competitor response stops the batch before later requests or history changes',async t=>{
    const p=page(t);let requests=0;p.saved.paine99schedule={keep:true};
    p.w.fetch=async url=>{requests++;return respond(url,enterprise('0').replace('<td>1000</td>','<td>missing</td>'));};
    await assert.rejects(p.run("AESRead.collectCompetitor({id:'99',name:'Other',displayName:'Other',code:'OA'},()=>{})"),/Incomplete/);
    assert.equal(requests,1);assert.deepEqual(p.saved,{paine99schedule:{keep:true}});
});
