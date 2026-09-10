const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { mkdtemp, rm, readFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const {createServer} = require('node:https');
const {execFileSync} = require('node:child_process');

test('Chromium loads the extension runtime, exports real storage and injects the dashboard', { timeout: 60000 }, async t => {
    const profile = await mkdtemp(join(tmpdir(), 'aes-browser-'));
    const extension = resolve('build/extension');
    let context;
    let server;
    let releaseFirst;
    const inventoryRequests = [];
    const priceRequests = [];
    const firstGate = new Promise(resolve => { releaseFirst = resolve; });
    t.after(async () => {
        releaseFirst();
        if (context) await context.close();
        if (server) {server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));}
        await rm(profile, {recursive:true,force:true});
    });
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(profile,'key.pem'),'-out',join(profile,'cert.pem'),'-days','1','-subj','/CN=paine.airlinesim.aero'],{stdio:'ignore'});
    const fixture = `<script>window.frontendSettings = {"fixedEnterpriseId":42,"server":{"time":"2026-09-08T00:00:00Z"}};</script>
        <div id="header"><div><button aria-haspopup="menu"><span class="_name_test">AES Airlines</span><span class="_code_test">AA</span></button><div role="menubar"></div></div></div>
        <div class="bootstrap container-fluid"><h1>Dashboard</h1><div id="enterprise-dashboard"></div></div>`;
    const cabins=['Y','C','F','Cargo'];
    const prices=`<form class="pricing" method="post"><table><tbody>${cabins.map(c=>`<tr><td>${c}</td><td>100</td><td><input name="price${c}" value="100"></td><td></td><td>100</td></tr>`).join('')}</tbody></table><button name="submit-prices">Submit prices</button></form>`;
    const validation='<ul><li class="active">All Flight Numbers</li></ul><div><div><div><fieldset></fieldset><fieldset></fieldset><fieldset><div><input type="checkbox" checked><input type="checkbox" checked><input type="checkbox"><input type="checkbox"></div></fieldset></div></div></div>';
    const inventoryFixture=fixture+`<h2><a>AAA</a><a>BBB</a></h2><div class="container-fluid"><div class="row"><div class="col-md-10"><div><div class="as-panel">${prices}</div><div class="as-panel">${validation}</div><table id="inventory-table"><tbody><tr><td></td><td><a href="numbers/1">AA 100</a></td><td>08.09.</td><td></td><td></td><td>Y</td><td>100</td><td>80</td><td></td><td>100</td><td>finished</td></tr></tbody></table></div></div></div></div>`;
    server=createServer({key:await readFile(join(profile,'key.pem')),cert:await readFile(join(profile,'cert.pem'))},async(req,res)=>{
        if (req.url.startsWith('/app/com/inventory/')) {
            if (req.method === 'POST') priceRequests.push(Date.now());
            else {inventoryRequests.push(Date.now()); if (inventoryRequests.length === 1) await firstGate;}
        }
        res.writeHead(200,{'Content-Type':'text/html'});req.resume();res.end(req.url.startsWith('/app/com/inventory/') ? inventoryFixture : fixture);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const port=server.address().port;
    // Chrome-created tabs can bypass Playwright routing on their first request.
    // Resolve every host to this local HTTPS fixture server instead.
    context = await chromium.launchPersistentContext(profile, {
        channel:'chromium',headless:true,ignoreHTTPSErrors:true,
        args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,
            `--host-resolver-rules=MAP * 127.0.0.1:${port}`,'--no-proxy-server','--ignore-certificate-errors'],
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().version), '0.8.13');
    await worker.evaluate(async () => {
        await chrome.storage.local.clear();
        await chrome.storage.local.set({settings:{general:{defaultDashboard:'general'},schedule:{},invPricing:{autoAnalysisSave:0,autoPriceUpdate:0,autoClose:0,showReferenceRecommendation:1,historyTable:{showNow:1,showOnlyPricing:0,numberOfDates:'5'},recommendation:Object.fromEntries(['Y','C','F','Cargo'].map(c=>[c,{minPrice:60,maxPrice:200,steps:[{min:0,max:100,name:'Raise',step:10}]}]))}}, migrationSmoke:{preserve:true},
            paine42schedule:{type:'schedule',server:'paine',airline:{id:'42'},date:{'20260908':{schedule:Array.from({length:12},(_,i)=>({origin:'AAA',destination:'B'+i,od:'AAAB'+i,flightNumber:{100:{paxFreq:7,cargoFreq:0}}}))}}}});
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`chrome-extension://${id}/options.html`);
    await page.locator('#aes-backup-btn').waitFor();
    assert.equal(await page.evaluate(() => jQuery.fn.jquery), '4.0.0');
    assert.equal(await page.evaluate(() => typeof jQuery.fn.delay), 'function');
    const downloadReady = page.waitForEvent('download');
    await page.locator('#aes-backup-btn').click();
    const download = await downloadReady;
    const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.deepEqual(backup.data.migrationSmoke, {preserve:true});
    await page.goto(`chrome-extension://${id}/popup.html`);
    const optionsReady = context.waitForEvent('page');
    await page.locator('#aes-openOptions-btn').click();
    const openedOptions = await optionsReady;
    await openedOptions.waitForURL(`chrome-extension://${id}/options.html`);
    await page.goto('https://paine.airlinesim.aero/app/enterprise/dashboard');
    await page.locator('#aes-dashboard-root').waitFor();
    await page.locator('#aes-select-dashboard-main').selectOption('routeManagement');
    // Exercise the content-script sender/document identity and background CAS in Chrome.
    assert.equal(await worker.evaluate(async () => {
        for (let i = 0; i < 100; i++) {
            const settings = (await chrome.storage.local.get('settings')).settings;
            if (settings.general.defaultDashboard === 'routeManagement') return true;
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        return false;
    }), true);
    await page.locator('#aes-select-dashboard-main').selectOption('general');
    await page.locator('#aes-div-dashboard-general').waitFor();
    assert.deepEqual(await worker.evaluate(async () => (await chrome.storage.local.get('migrationSmoke')).migrationSmoke), {preserve:true});
    await page.locator('#aes-select-dashboard-main').selectOption('routeManagement');
    const releaseClose = page.locator('.aes-release-notes-close');
    if (await releaseClose.count()) await releaseClose.click();
    await page.getByRole('button', {name:'Select first 10',exact:true}).click();
    await page.getByRole('button', {name:'Open inventory (max 10)',exact:true}).click();
    const waitUntil = async check => {
        for (let i=0;i<400;i++) {if(check()) return; await new Promise(resolve=>setTimeout(resolve,100));}
        throw new Error('Queue browser condition timed out');
    };
    assert.equal(await page.locator('#aes-table-routeManagement tbody input:checked').count(), 10);
    await waitUntil(()=>inventoryRequests.length>=1);
    await waitUntil(()=>inventoryRequests.length===10);
    releaseFirst(); // All ten dispatch while the first page is still loading.
    for(let i=1;i<inventoryRequests.length;i++) assert.ok(inventoryRequests[i]-inventoryRequests[i-1]>=20,'page requests are paced');
    assert.equal(inventoryRequests.length,10);
    const inventoryPages=context.pages().filter(p=>p.url().includes('/app/com/inventory/'));
    await Promise.all(inventoryPages.slice(0,2).map(p=>p.locator('#aes-table-analysis').waitFor()));
    // One AES submission and one native submission must share the navigation queue.
    await inventoryPages[0].locator('#aes-btn-invPricing-apply-new-prices').click();
    await inventoryPages[1].locator('[name="submit-prices"]').click();
    await waitUntil(()=>priceRequests.length===2);
    assert.ok(priceRequests[0]-inventoryRequests.at(-1)>=20,'price submission shares navigation spacing');
    assert.ok(priceRequests[1]-priceRequests[0]>=20,'both price entry points share the same queue');
    assert.deepEqual(errors, []);
});
