const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const {resolve}=require('node:path');

test('collapsed legacy navigation opens AES on click and keeps it open when the pointer leaves',async t=>{
    const browser=await chromium.launch({channel:'chromium',headless:true});
    t.after(()=>browser.close());
    const page=await browser.newPage({viewport:{width:600,height:800}});
    await page.setContent(`<style>
        .navbar-toggle{display:block}.navbar-nav{list-style:none;padding:0}
        .navbar-nav>li{width:180px} .dropdown-menu{padding:10px}
        @media(min-width:900px){.navbar-toggle{display:none}}
        </style><nav class="as-navbar-main"><button class="navbar-toggle">Toggle navigation</button>
        <ul class="navbar-nav"><li>Management</li></ul></nav><button id="outside">Outside</button>`);
    await page.evaluate(()=>{
        window.AES={runContentScript:(_name,fn)=>fn(),isPageOwner:()=>true,markOwnedElements:()=>{},whenPageOwnershipLost:()=>{}};
        window.AESI18n={t:s=>s};window.chrome={runtime:{getManifest:()=>({version_name:'test'})}};
    });
    await page.addStyleTag({path:resolve('extension/css/content.css')});
    await page.addScriptTag({path:resolve('build/extension/modules/aes-menu.js')});
    const button=page.locator('#aes-menu > a'),menu=page.locator('#aes-menu-items');
    const expanded=()=>button.getAttribute('aria-expanded');
    await button.hover();assert.equal(await expanded(),'false');assert.equal(await menu.isVisible(),false);
    await button.click();assert.equal(await expanded(),'true');assert.equal(await menu.isVisible(),true);
    await page.locator('#outside').hover();assert.equal(await expanded(),'true');
    await button.click();assert.equal(await expanded(),'false');
    await button.press('Space');assert.equal(await expanded(),'true');
    await button.press('Escape');assert.equal(await expanded(),'false');assert.ok(await button.evaluate(e=>e===document.activeElement));
    await button.click();await page.locator('#outside').click();assert.equal(await expanded(),'false');
    // Test the game's toggle state, not a hard-coded 768 px breakpoint.
    await page.setViewportSize({width:850,height:800});
    await button.hover();assert.equal(await expanded(),'false');
    await page.setViewportSize({width:1200,height:800});
    await page.locator('#outside').hover();await button.hover();assert.equal(await expanded(),'true');
    await page.locator('#outside').hover();assert.equal(await expanded(),'false');
});
