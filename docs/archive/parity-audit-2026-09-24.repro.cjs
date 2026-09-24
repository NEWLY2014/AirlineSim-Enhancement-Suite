// Audit probes against the actual v0.8.13 Git source. Build first; no live game requests.
const root=require('node:path').resolve(__dirname,'../..');process.chdir(root);const {browser,source}=require(root+'/test/support/browser.cjs');const {execFileSync}=require('child_process');const assert=require('assert/strict');
const clean=x=>JSON.parse(JSON.stringify(x));const cleanup=[];const t={after:f=>cleanup.push(f)};
function isolated(file,expose,old=false){const p=browser(t);p.run('AES.runContentScript=()=>false;');let code=old?execFileSync('git',['show','v0.8.13:extension/'+file],{encoding:'utf8'}):source(file);if(old)code+='\n'+expose;else code=code.replace(/\}\)\(\);\s*$/,expose+'\n})();');p.run(code);return p;}
const exposure='window.audit={analyze:(s,f,p,h)=>{settings=s;return getAnalysis(f,p,h).data}};';const old=isolated('content_inventory.js',exposure,true),now=isolated('content_inventory.js',exposure);
const defaults=execFileSync('git',['show','v0.8.13:extension/background.js'],{encoding:'utf8'});const begin=defaults.indexOf('function setDefaultInvPricingSettings()');const end=defaults.indexOf('function isAllowedAESTabUrl');old.run(defaults.slice(begin,end)+';window.oldSettings={invPricing:setDefaultInvPricingSettings()};');const s=clean(old.w.oldSettings);now.run('window.audit.readSettings=AESInventoryData.readInventorySettings;');assert.deepEqual(clean(now.w.audit.readSettings(s)),{...s,invPricing:{...s.invPricing,mode:'steps'}});
let n=0;const fields=['totalCap','totalBkd','analysisPrice','analysisPricePoint','valid','canRecommend','useCurrentPrice','newPrice','newPricePoint','newPriceChange','recType','recommendation','referenceNewPrice','referenceNewPricePoint','referenceRecommendation','index'];
for(const cap of [100,123])for(const load of [0,1,39,40,41,59,60,61,69,70,71,79,80,81,89,90,91,98,99,100])for(const base of [37,100,157])for(const pricePoint of [40,60,100,199,220])for(const active of [true,false]){const price=Math.round(base*pricePoint/100);const p=Object.fromEntries(['Y','C','F','Cargo'].map(c=>[c,{currentPrice:price,defaultPrice:base,currentPricePoint:Math.round(price/base*100)}]));const flights=['Y','C','F','Cargo'].map(c=>({cmp:c,fltNr:'AA 100',cap,bkd:Math.round(cap*load/100),price:active?price:Math.max(1,price-10),status:'finished'}));const a=old.w.audit.analyze(clean(s),clean(flights),clean(p),{}),b=now.w.audit.analyze(clean(s),clean(flights),clean(p),{});for(const c of ['Y','C','F','Cargo'])for(const f of fields)assert.equal(b[c][f],a[c][f],`${n} ${c} ${f}`);n++;}
console.log('PASS: 0.8.13 defaults accepted unchanged; step recommendations match '+n+' scenarios × 4 cabins.');


(async()=>{
    const baseline=isolated('content_dashboard.js','window.audit={columns:getDefaultCompetitorMonitoringColumns(),route:getDefaultRouteManagementSettings()};',true);
    const columns=clean(baseline.w.audit.columns);
    const header='<script>window.frontendSettings = {"fixedEnterpriseId":42,"server":{"time":"2026-09-24T00:00:00Z"}};</script><div id="header"><div><button aria-haspopup="menu"><span class="_name_test">AES Airlines</span></button><div role="menubar"></div></div></div>';
    const page=browser(t,{path:'/app/enterprise/dashboard',html:header+'<div id="enterprise-dashboard"></div>',data:{aesLanguage:'zh-TW',settings:{general:{defaultDashboard:'competitorMonitoring'},competitorMonitoring:{tableColumns:columns,filter:[]}}}});
    page.load('content_dashboard.js');await require(root+'/test/support/browser.cjs').until(()=>page.w.document.querySelector('.aes-dashboard-column-choice'));
    const broken=[...page.w.document.querySelectorAll('.aes-dashboard-column-choice')].map(e=>e.textContent).filter(text=>text.includes('&Delta;'));
    assert.equal(broken.length,0);
    console.log('PASS: legacy competitor labels migrate to translated plain text.');
    const empty=isolated('content_flightSchedule.js','window.audit={extract:()=>{server="paine";airline={id:"99"};date={date:"20260924",time:"00:00 UTC"};extractSchedule();}};',true);
    empty.w.document.body.innerHTML='<div class="flight-schedule"><div class="as-panel">No flights scheduled.</div></div>';
    empty.w.audit.extract();
    assert.deepEqual(clean(empty.saved.paine99schedule.date['20260924'].schedule),[]);
    // The original synthetic empty markup remains unrecognized and must not
    // overwrite history. Use the subsequently inspected game empty state below.
    await assert.rejects(empty.run('AESRead.parseSchedule(document,()=>{},()=>true)'));
    const {enterprise,emptySchedule,respond}=require(root+'/test/support/read-pages.cjs');
    const batch=browser(t,{path:'/app/enterprise/dashboard',html:header});
    batch.w.fetch=async url=>respond(url,new URL(url).searchParams.get('tab')==='3' ? emptySchedule() : enterprise(new URL(url).searchParams.get('tab')));
    await batch.run("AESRead.collectCompetitor({id:'99',name:'Other',displayName:'Other',code:'OA'},()=>{})");
    assert.deepEqual(clean(batch.saved.paine99schedule.date['20260908'].schedule),[]);
    assert.ok(batch.saved.paine42_99competitorMonitoring);
    console.log('PASS: verified empty schedule and competitor save-all are saved.');
    const originalManifest=JSON.parse(execFileSync('git',['show','v0.8.13:extension/manifest.json'],{encoding:'utf8'}));
    const currentManifest=require(root+'/extension/manifest.json');
    for(const script of originalManifest.content_scripts) for(const match of script.matches) assert.ok(currentManifest.content_scripts.some(current=>current.matches.includes(match)),match);
    console.log('PASS: every 0.8.13 content-script URL pattern remains present.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{for(const f of cleanup)f();});
