const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
async function pageFor(t){
    const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
    const page=await browser.newPage();
    await page.setContent('<button id="trigger">Open</button><button id="background">Background action</button>');
    await page.addScriptTag({path:'build/extension/js/vendor/jquery-4.0.0.min.js'});
    await page.addScriptTag({content:`window.AES={whenPageOwnershipLost(){},runContentScript(){},markOwnedElements(){},getFrontendSettings(){return {theme:window.theme || 'dark'}},compareVersions(a,b){return a.localeCompare(b,undefined,{numeric:true})}};window.chrome={runtime:{getURL(p){return p}},storage:{local:{set(v,cb){window.saved=v;cb()}}}};`});
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
