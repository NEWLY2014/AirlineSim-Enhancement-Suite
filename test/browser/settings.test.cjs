const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const {mkdtemp,rm,readFile}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {createServer}=require('node:https');
const {execFileSync}=require('node:child_process');

test('settings tabs preserve drafts, support the keyboard and open extension backup options', {timeout:60000},async t=>{
    const profile=await mkdtemp(join(tmpdir(),'aes-settings-browser-'));let context,server;let submissions=0;
    t.after(async()=>{if(context)await context.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(profile,{recursive:true,force:true});});
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(profile,'key.pem'),'-out',join(profile,'cert.pem'),'-days','1','-subj','/CN=paine.airlinesim.aero'],{stdio:'ignore'});
    server=createServer({key:await readFile(join(profile,'key.pem')),cert:await readFile(join(profile,'cert.pem'))},(req,res)=>{
        if(req.method==='POST' && req.headers.host==='paine.airlinesim.aero')submissions++;
        const game=req.url.includes('tab=game');
        const html=`<script>window.frontendSettings={"fixedEnterpriseId":42,"theme":"light","server":{"time":"2026-09-17T01:00:00Z"}};</script>
        <style>.nav-tabs{display:flex;gap:20px;list-style:none}.nav-tabs a{display:block;padding:10px}.nav-tabs .active{border-bottom:2px solid}.tab-content{display:block}</style>
        <div id="header"><div><button aria-haspopup="menu"><span class="_name_test">Test Air</span></button><div role="menubar"></div></div></div>
        <div class="bootstrap container-fluid"><h1>Settings</h1><div class="as-panel"><ul class="nav nav-tabs">
        <li class="tab0 ${game?'':'active'}"><a href="./settings?tab=general">General settings</a></li><li class="tab1 ${game?'active':''}"><a href="./settings?tab=game">Game settings</a></li></ul>
        <div class="tab-content"><div class="tab-pane active"><form method="post"><label>Native draft<textarea id="native-draft">${game?'Game':'General'}</textarea></label><button type="submit">Save native</button></form></div></div></div></div>`;
        req.resume();res.writeHead(200,{'Content-Type':'text/html'});res.end(html);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const extension=resolve('build/extension');
    context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,ignoreHTTPSErrors:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,`--host-resolver-rules=MAP * 127.0.0.1:${server.address().port}`,'--no-proxy-server','--ignore-certificate-errors']});
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    await worker.evaluate(()=>chrome.storage.local.set({aesReleaseNotesSeenVersion:'0.8.13',settings:{invPricing:{recommendation:{Y:{minPrice:60,maxPrice:200,steps:[]}}}}}));
    const page=await context.newPage();await page.goto('https://paine.airlinesim.aero/app/enterprise/settings');
    const aes=page.getByRole('tab',{name:'AES Settings',exact:true});await aes.waitFor();
    assert.equal(await page.locator('#aes-settings-root').isVisible(),false);
    await page.getByLabel('Native draft').fill('Keep unsaved company profile');
    const before=await page.locator('.nav-tabs').boundingBox();
    await page.getByRole('tab',{name:'General settings',exact:true}).focus();
    await page.keyboard.press('End');await page.keyboard.press('Enter');
    assert.equal(await aes.getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('.tab-content').isVisible(),false);
    assert.deepEqual(await page.locator('.nav-tabs').boundingBox(),before);
    await page.locator('#aes-input-invPricing-min-price').fill('73');
    await page.getByRole('tab',{name:'Flight Info',exact:true}).click();
    await page.getByRole('tab',{name:'Inventory Pricing',exact:true}).click();
    assert.equal(await page.locator('#aes-input-invPricing-min-price').inputValue(),'73');
    await page.getByRole('tab',{name:'General settings',exact:true}).click();
    assert.equal(await page.getByLabel('Native draft').inputValue(),'Keep unsaved company profile');
    await aes.click();
    const [options]=await Promise.all([context.waitForEvent('page'),page.getByRole('button',{name:'Backup & Restore',exact:true}).click()]);
    await options.waitForURL(/options\.html/);assert.match(options.url(),/^chrome-extension:/);
    await page.getByRole('tab',{name:'Flight Info',exact:true}).click();
    await page.getByRole('tab',{name:'Game settings',exact:true}).click();
    await page.waitForURL(/tab=game/);await aes.click();
    assert.equal(await page.getByRole('tab',{name:'Flight Info',exact:true}).getAttribute('aria-selected'),'true');
    assert.equal(submissions,0);
});
