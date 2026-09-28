const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const {mkdtemp,rm,readFile}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {createServer}=require('node:https');
const {execFileSync}=require('node:child_process');

test('salary native submissions share queue pacing without response verification or retries',{timeout:60000},async t=>{
    const profile=await mkdtemp(join(tmpdir(),'aes-salary-'));
    let context,server;
    t.after(async()=>{
        await context?.close();
        if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
        await rm(profile,{recursive:true,force:true});
    });
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(profile,'key.pem'),'-out',join(profile,'cert.pem'),'-days','1','-subj','/CN=paine.airlinesim.aero'],{stdio:'ignore'});
    const amounts=[800,700],requests=[],responses=[];

    const render=()=>`<!doctype html><script>window.frontendSettings = {"fixedEnterpriseId":42,"server":{"time":"2026-09-08T00:00:00Z"}};</script>
    <div id="header"><div><button aria-haspopup="menu"><span class="_name_test">AES Airlines</span></button><div role="menubar"></div></div></div>
    <div class="bootstrap container-fluid"><h1>Employee Overview</h1><table>
    <thead><tr><th>Staff</th><th>Next week's salary</th><th>Country average</th></tr></thead><tbody>
    ${amounts.map((amount,id)=>`<tr><td>${id?'Cabin crew':'Pilots'}</td><td><form method="post" action="staffOverview">
    <input type="hidden" name="action" value="salary"><input type="hidden" name="id" value="${id}">
    <input name="amount" value="${amount}"><div class="input-group-btn"><input type="submit" value="adjust"></div>
    </form></td><td>${id?900:1000} AS$</td></tr>`).join('')}</tbody></table></div>`;
    server=createServer({key:await readFile(join(profile,'key.pem')),cert:await readFile(join(profile,'cert.pem'))},async(req,res)=>{
        if(req.method==='POST' && req.url==='/action/enterprise/staffOverview'){
            let body='';for await(const chunk of req)body+=chunk;
            const data=new URLSearchParams(body),id=Number(data.get('id')),amount=Number(data.get('amount'));
            requests.push({id,amount,time:Date.now()});amounts[id]=Math.min(amount,1100);
            responses.push(res);
            // Delay all responses until both native forms have been dispatched.
            // A verifier would stall here; the server deliberately clamps the values.
            if(responses.length===2)for(const pending of responses){pending.writeHead(200,{'Content-Type':'text/html'});pending.end(render());}
            return;
        }
        res.writeHead(200,{'Content-Type':'text/html'});res.end(render());
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const ext=resolve('build/extension');
    context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,ignoreHTTPSErrors:true,args:[
        `--disable-extensions-except=${ext}`,`--load-extension=${ext}`,
        `--host-resolver-rules=MAP * 127.0.0.1:${server.address().port}`,'--no-proxy-server','--ignore-certificate-errors']});
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    await worker.evaluate(()=>chrome.storage.local.set({aesReleaseNotesSeenVersion:chrome.runtime.getManifest().version_name,settings:{personnelManagement:{type:'perc',value:200,auto:0,alreadyUpdated:[]}}}));
    const page=await context.newPage();
    let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
    await page.goto('https://paine.airlinesim.aero/action/enterprise/staffOverview');
    await page.locator('#aes-select-personnelManagement-type').selectOption('perc');
    await page.locator('#aes-input-personnelManagement-value').fill('200');
    await page.locator('.aes-personnel-management-apply').click();
    await page.waitForFunction(()=>document.querySelector('input[name=amount]')?.defaultValue==='1100');
    await page.locator('.aes-personnel-management-apply:not([disabled])').waitFor();
    assert.deepEqual(requests.map(({id,amount})=>({id,amount})),[{id:0,amount:3000},{id:1,amount:2700}]);
    assert.ok(requests[1].time-requests[0].time>=55,'shared queue must pace native dispatch');
    assert.deepEqual(amounts,[1100,1100]);
    assert.equal(navigations,2,'initial page plus native response, with no AES refresh');
    const record=await worker.evaluate(async()=>(await chrome.storage.local.get('paine42personnelManagement')).paine42personnelManagement);
    assert.equal(record.date,'20260908');assert.equal(record.pending,undefined);
    assert.doesNotMatch(await page.locator('#aes-personnel-management-last-update').innerText(),/awaiting|Updating/);
});
