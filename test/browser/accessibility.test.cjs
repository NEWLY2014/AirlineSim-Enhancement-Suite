const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
async function pageFor(t){
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage();
    await page.setContent('<button id="trigger">Open</button><button id="background">Background action</button>');
    await page.addScriptTag({path:'build/extension/js/vendor/jquery-4.0.0.min.js'});
    await page.addScriptTag({content:`window.AES={yieldToPage(){return window.scheduler?.postTask ? window.scheduler.postTask(()=>{},{priority:'background'}) : window.scheduler?.yield ? window.scheduler.yield() : new Promise(resolve=>setTimeout(resolve,0))},whenPageOwnershipLost(){},runContentScript(){},markOwnedElements(){},getFrontendSettings(){return {theme:window.theme || 'dark'}},compareVersions(a,b){return a.localeCompare(b,undefined,{numeric:true})}};window.chrome={runtime:{getURL(p){return p}},storage:{local:{set(v,cb){window.saved=v;cb()}}}};`});
    await page.addScriptTag({path:'build/extension/modules/i18n-data.js'});
    await page.addScriptTag({path:'build/extension/modules/i18n.js'});
    await page.addStyleTag({path:'extension/css/content.css'});
    return page;
}
test('release notes isolate background focus and restore the opener after Escape',async t=>{
    const page=await pageFor(t);
    await page.addScriptTag({path:'build/extension/modules/release-notes.js'});
    await page.evaluate(()=>document.querySelector('#trigger').onclick=()=>new ReleaseNotesDialog('0.8.13'));
    await page.click('#trigger');
    assert.equal(await page.locator('#aes-release-notes-dialog').evaluate(el=>el.matches(':modal')),true);
    await page.focus('#background');
    assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#aes-release-notes-dialog')),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#aes-release-notes-dialog').count(),0);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'trigger');
    assert.equal(await page.evaluate(()=>saved.aesReleaseNotesSeenVersion),'0.8.13');
});

test('schedule comparison follows the game theme independently of system colors',async t=>{
    const page=await pageFor(t);
    await page.addScriptTag({path:'build/extension/modules/schedule-diff.js'});
    for(const [theme,system,expected] of [['dark','light',['rgb(241, 243, 245)','rgb(48, 52, 59)']],['light','dark',['rgb(62, 58, 51)','rgb(247, 245, 239)']],['classic','dark',['rgb(62, 58, 51)','rgb(247, 245, 239)']]]){
        await page.emulateMedia({colorScheme:system});
        await page.evaluate(theme=>{window.theme=theme;AESScheduleDiff.open({},'Airline')},theme);
        assert.deepEqual(await page.locator('dialog').evaluate(el=>[getComputedStyle(el).color,getComputedStyle(el).backgroundColor]),expected);
        await page.getByRole('button',{name:'Close',exact:true}).click();
    }
});

test('large schedule comparisons yield during comparison and sorting, and support cancellation',async t=>{
    const page=await pageFor(t);
    await page.addScriptTag({path:'build/extension/modules/schedule-diff.js'});
    const result=await page.evaluate(async()=>{
        const flights={},next={};
        for(let n=50000;n>0;n--){
            flights['WN '+n]={paxFreq:7,cargoFreq:0,valid:'Now',remark:'',services:[{days:'1234567',departure:'08:00',arrival:'10:00',aircraft:'A320',valid:'Now',remark:''}]};
            next['WN '+n]={...flights['WN '+n],paxFreq:6};
        }
        const capture=flightNumber=>({id:'x',label:'test',schedule:[{origin:'AAA',destination:'BBB',flightNumber}]});
        const a=capture(flights),b=capture(next);
        await new Promise(resolve=>requestAnimationFrame(resolve));
        let beats=0,last=performance.now(),gap=0;
        let running=true;
        const beat=()=>{if(!running)return;const now=performance.now();gap=Math.max(gap,now-last);last=now;beats++;requestAnimationFrame(beat);};
        requestAnimationFrame(beat);
        const compared=await AESScheduleDiff.compare(a,b);running=false;
        let current=true;const pending=AESScheduleDiff.compare(a,b,()=>current);requestAnimationFrame(()=>{current=false});
        let cancelled=false;try{await pending}catch{cancelled=true}
        return {beats,gap,changes:compared.changes.length,first:compared.changes[0].flight,last:compared.changes.at(-1).flight,cancelled};
    });
    assert.equal(result.changes,50000);assert.equal(result.first,'WN 1');assert.equal(result.last,'WN 50000');
    assert.ok(result.beats>2,JSON.stringify(result));assert.ok(result.gap<100,JSON.stringify(result));assert.equal(result.cancelled,true);
    t.diagnostic(JSON.stringify(result));
});

test('comparison restores the initiating button after Close and Escape',async t=>{
    const page=await pageFor(t);
    await page.addScriptTag({path:'build/extension/modules/schedule-diff.js'});
    await page.evaluate(()=>document.querySelector('#trigger').onclick=()=>AESScheduleDiff.open({},'Airline'));
    for(const action of ['close','escape']){
        await page.click('#trigger');
        if(action==='close') await page.getByRole('button',{name:'Close',exact:true}).click();else await page.keyboard.press('Escape');
        assert.equal(await page.locator('dialog').count(),0);
        assert.equal(await page.evaluate(()=>document.activeElement.id),'trigger');
    }
});
