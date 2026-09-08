const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { mkdtemp, rm, readFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

test('Chromium loads the extension runtime, exports real storage and injects the dashboard', { timeout: 60000 }, async t => {
    const profile = await mkdtemp(join(tmpdir(), 'aes-browser-'));
    const extension = resolve('build/extension');
    let context;
    t.after(async () => {
        if (context) await context.close();
        await rm(profile, { recursive: true, force: true });
    });
    context = await chromium.launchPersistentContext(profile, {
        channel: 'chromium', headless: true,
        args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    // Fulfill every web request locally: this test never contacts the game server.
    await context.route('https://**/*', route => route.fulfill({
        contentType: 'text/html', body: `<script>window.frontendSettings = {"fixedEnterpriseId":42,"server":{"time":"2026-09-08T00:00:00Z"}};</script>
        <div id="header"><div><button aria-haspopup="menu"><span class="_name_test">AES Airlines</span><span class="_code_test">AA</span></button><div role="menubar"></div></div></div>
        <div class="bootstrap container-fluid"><h1>Dashboard</h1><div id="enterprise-dashboard"></div></div>`,
    }));
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().version), '0.8.13');
    await worker.evaluate(async () => {
        await chrome.storage.local.clear();
        await chrome.storage.local.set({settings:{general:{defaultDashboard:'general'},schedule:{}}, migrationSmoke:{preserve:true}});
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`chrome-extension://${id}/options.html`);
    await page.locator('#aes-backup-btn').waitFor();
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
    await page.locator('#aes-select-dashboard-main').selectOption('general');
    await page.locator('#aes-div-dashboard-general').waitFor();
    assert.deepEqual(await worker.evaluate(async () => (await chrome.storage.local.get('migrationSmoke')).migrationSmoke), {preserve:true});
    assert.deepEqual(errors, []);
});
