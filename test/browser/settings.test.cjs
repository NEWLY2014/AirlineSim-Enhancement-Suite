const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const {mkdtemp,rm,readFile}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {createServer}=require('node:https');
const {execFileSync}=require('node:child_process');

test('settings tabs preserve drafts, support the keyboard and open extension backup options', {timeout:60000},async t=>{
    const profile=await mkdtemp(join(tmpdir(),'aes-settings-browser-'));let context,server;let submissions=0;let gameLanguage='en';
    t.after(async()=>{if(context)await context.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(profile,{recursive:true,force:true});});
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(profile,'key.pem'),'-out',join(profile,'cert.pem'),'-days','1','-subj','/CN=paine.airlinesim.aero'],{stdio:'ignore'});
    server=createServer({key:await readFile(join(profile,'key.pem')),cert:await readFile(join(profile,'cert.pem'))},(req,res)=>{
        if(req.method==='POST' && req.headers.host==='paine.airlinesim.aero')submissions++;
        if(req.url.startsWith('/app/fleets')){
            const rows=Array.from({length:22},(_,i)=>`<tr><td><input type="checkbox" name="aircraftsContainer"></td><td><span>AA-${i}</span><div>...</div></td><td><a>A320</a></td><td></td><td><span>2 years</span><div><span></span><span>95%</span></div></td><td><span>100</span><span>10</span><span>0</span><div class="subrow">Yes</div></td><td></td><td>${i?`<a title="Flight Planning" class="btn-success" href="/app/fleets/aircraft/${100+i}/0"></a>`:''}</td></tr>`).join('');
            req.resume();res.writeHead(200,{'Content-Type':'text/html'});res.end(`<script>window.frontendSettings={"fixedEnterpriseId":42,"languageSettings":{"currentLanguageTag":"${gameLanguage}"},"server":{"time":"2026-09-17T01:00:00Z"}};</script><div id="header"><button aria-haspopup="menu"><span class="_name_test">Test Air</span></button><div role="menubar"></div></div><div class="as-page-fleet-management"><h1>Fleet</h1><div class="row"><div class="col-md-9"><h2>Main</h2><div class="as-panel"><table><thead><tr>${'<th>Aircraft model</th>'.repeat(8)}</tr></thead><tbody>${rows}</tbody></table></div></div></div></div>`);return;
        }
        const game=req.url.includes('tab=game');
        const html=`<script>window.frontendSettings={"fixedEnterpriseId":42,"theme":"light","languageSettings":{"currentLanguageTag":"${gameLanguage}"},"server":{"time":"2026-09-17T01:00:00Z"}};</script>
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
    await page.getByRole('tab',{name:'General Settings',exact:true}).waitFor();
    assert.equal(await page.locator('#aes-language').isVisible(),true);
    const tabStyle=await page.locator('#aes-settings-group-0').evaluate(el=>({
        buttonStyle:el.classList.contains('btn'), border:getComputedStyle(el).borderBottomWidth,
        radius:getComputedStyle(el).borderRadius, selected:el.getAttribute('aria-selected')
    }));
    assert.deepEqual(tabStyle,{buttonStyle:false,border:'3px',radius:'0px',selected:'true'});
    await page.locator('#aes-settings-group-0').focus();
    await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
    assert.equal(await page.locator('#aes-settings-group-1').getAttribute('aria-selected'),'true');
    await page.getByRole('tab',{name:'Inventory Pricing',exact:true}).click();
    assert.equal(await page.locator('#aes-language').isVisible(),false);
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
    // Exercise every supported game locale with the packaged extension, including long labels.
    const {readdirSync,readFileSync}=require('node:fs');
    for(const file of readdirSync('extension/locales')){
        gameLanguage=file.slice(0,-5);
        const messages=JSON.parse(readFileSync('extension/locales/'+file));
        await worker.evaluate(()=>chrome.storage.local.set({aesLanguage:'auto'}));
        await page.reload();await page.locator('#aes-settings-tab').click();
        await page.locator('#aes-settings-group-1').click();
        assert.equal(await page.locator('#aes-settings-tab').textContent(),messages['AES Settings']);
        assert.equal(await page.locator('#aes-btn-invPricing-save').textContent(),messages.Save);
        assert.equal(await page.getByRole('tab',{name:'General settings',exact:true}).count(),1);
        assert.equal(await page.locator('#aes-input-invPricing-max-price').inputValue(),'200');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,gameLanguage);
    }
    await page.locator('#aes-input-invPricing-min-price').fill('79');
    await page.locator('#aes-settings-group-0').click();
    await page.locator('#aes-language').selectOption('fr');
    await page.waitForFunction(()=>document.querySelector('.aes-language-control [role="status"]').textContent.length>0);
    assert.equal(await page.locator('.aes-language-control [role="status"]').textContent(),JSON.parse(readFileSync('extension/locales/fr.json'))['Language saved. Reload this page to apply.']);
    assert.equal(await page.locator('.aes-language-control [role="status"]').getAttribute('lang'),'fr');
    await page.locator('#aes-settings-group-1').click();
    assert.equal(await page.locator('#aes-input-invPricing-min-price').inputValue(),'79');
    assert.equal(await worker.evaluate(()=>chrome.storage.local.get('aesLanguage').then(v=>v.aesLanguage)),'fr');
    await page.reload();await page.locator('#aes-settings-tab').click();
    const french=JSON.parse(readFileSync('extension/locales/fr.json'));
    assert.equal(await page.locator('#aes-settings-tab').textContent(),french['AES Settings']);
    await options.reload();
    await options.waitForFunction(()=>document.documentElement.lang==='fr');
    await options.getByRole('button',{name:french['Create Backup'],exact:true}).waitFor();
    // Regression for the reported fleet paragraph, using the installed extension in Chromium.
    for(const file of readdirSync('extension/locales')){
        gameLanguage=file.slice(0,-5);const messages=JSON.parse(readFileSync('extension/locales/'+file));
        await worker.evaluate(()=>chrome.storage.local.set({aesLanguage:'auto'}));
        await page.goto('https://paine.airlinesim.aero/app/fleets');
        await page.locator('#aes-fleet-management-root').waitFor();
        const text=await page.locator('#aes-fleet-management-root').textContent();
        assert.ok(text.includes(messages['Currently {0} aircrafts stored in memory.'].replace('{0}','22')),gameLanguage);
        assert.ok(text.includes(messages['Undelivered aircraft are stored by registration and will be merged once AirlineSim assigns an aircraft ID.']),gameLanguage);
    }
    assert.equal(submissions,0);
});
