const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,readdirSync}=require('node:fs');
const {browser,until}=require('./support/browser.cjs');
const catalogs=Object.fromEntries(readdirSync('extension/locales').map(file=>[file.slice(0,-5),JSON.parse(readFileSync('extension/locales/'+file))]));
const header='<div id="header"><button aria-haspopup="menu"><span class="_name_test">Test Air</span></button><div role="menubar"></div></div>';
function config(lang){return `<script>window.frontendSettings={"fixedEnterpriseId":42,"server":{"time":"2026-09-17T00:00:00Z"},"languageSettings":{"currentLanguageTag":"${lang}"}};</script>`;}
test('all nine catalogs have complete keys and preserve message placeholders',()=>{
    assert.equal(Object.keys(catalogs).length,9);
    const tokens=s=>(s.match(/\{\w+\}/g)||[]).sort();
    for(const [lang,entries] of Object.entries(catalogs)){
        assert.deepEqual(Object.keys(entries).sort(),Object.keys(catalogs.en).sort(),lang);
        for(const [key,value] of Object.entries(entries)){
            assert.ok(value.trim(),`${lang}: ${key}`);
            assert.deepEqual(tokens(value),tokens(key),`${lang}: ${key}`);
        }
    }
});
test('game language takes priority over HTML lang and the last visited game; override takes priority over game',t=>{
    const auto=browser(t,{html:'<html lang="de">'+config('zh-TW'),data:{aesGameLanguage:'fr'}});
    assert.equal(auto.run('AESI18n.locale()'),'zh-TW');assert.equal(auto.saved.aesGameLanguage,'zh-TW');
    const override=browser(t,{html:config('de'),data:{aesLanguage:'ja'}});
    assert.equal(override.run('AESI18n.locale()'),'ja');assert.equal(override.saved.aesGameLanguage,'de');
    const cached=browser(t,{data:{aesGameLanguage:'pl'}});assert.equal(cached.run('AESI18n.locale()'),'pl');
    const unknown=browser(t,{data:{aesLanguage:'invalid',aesGameLanguage:'xx'}});assert.equal(unknown.run('AESI18n.locale()'),'en');
});
test('translation preserves whitespace, unknown text and placeholder data without HTML interpretation',t=>{
    const p=browser(t,{data:{aesLanguage:'zh-TW'}});
    assert.equal(p.run('AESI18n.t("  ")'),'  ');
    assert.equal(p.run('AESI18n.t("  Unknown   words  ")'),'  Unknown   words  ');
    p.run(`document.body.append(document.createElement('p'));document.querySelector('p').textContent=AESI18n.t('Schedule changes · {0}',{0:'<img src=x> {1}'});`);
    assert.equal(p.w.document.querySelector('img'),null);
    assert.match(p.w.document.querySelector('p').textContent,/<img src=x> \{1\}/);
    assert.equal(p.run(`AESI18n.t('  Save  ')`),'  '+catalogs['zh-TW'].Save+'  ');
});
for(const locale of Object.keys(catalogs))test(`${locale}: settings translate only AES UI and language saves preserve drafts`,async t=>{
    const p=browser(t,{html:config(locale)+header+'<div class="bootstrap container-fluid"><h1>Settings</h1><p id="airline">Save</p><textarea id="draft">Keep this</textarea></div>',path:'/app/enterprise/settings',data:{settings:{invPricing:{recommendation:{Y:{minPrice:60,maxPrice:200,steps:[]}}}}}});
    p.load('content_settings.js');await until(()=>p.w.document.querySelector('#aes-language'));
    const d=p.w.document;
    assert.equal(d.querySelector('#aes-settings-tab').textContent,catalogs[locale]['AES Settings']);
    assert.equal(d.querySelector('#aes-settings-group-0').textContent,catalogs[locale]['General Settings']);
    assert.equal(d.querySelector('.aes-settings-toolbar > button').textContent,catalogs[locale]['Backup & Restore']);
    assert.equal(d.querySelector('#aes-btn-invPricing-save').textContent,catalogs[locale].Save);
    assert.equal(d.querySelector('#aes-input-invPricing-max-price').value,'200');
    assert.equal(d.querySelector('#airline').textContent,'Save');
    d.querySelector('#aes-input-invPricing-min-price').value='73';
    p.w.$('#aes-language').val('ja').trigger('change');
    // Native change event is needed for addEventListener.
    d.querySelector('#aes-language').dispatchEvent(new p.w.Event('change'));
    assert.equal(p.saved.aesLanguage,'ja');assert.equal(d.querySelector('#draft').value,'Keep this');
    assert.equal(d.querySelector('#aes-input-invPricing-min-price').value,'73');
    assert.equal(p.saved.settings.invPricing.recommendation.Y.minPrice,60);
    assert.equal(p.run('AESI18n.locale()'),locale);
    assert.match(d.querySelector('.aes-language-control [role="status"]').textContent,new RegExp(catalogs.ja['Language saved. Reload this page to apply.'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
test('translated option text retains English enum values and language save failures retain preference',t=>{
    const p=browser(t,{data:{aesLanguage:'de'}});
    p.run(`document.body.innerHTML=AESI18n.html('<select><option>Added</option><option>Removed</option></select>');document.body.append(AESI18n.selector());`);
    assert.equal(p.w.document.querySelector('option').value,'Added');assert.equal(p.w.document.querySelector('option').textContent,catalogs.de.Added);
    p.failures.set='Disk full';const select=p.w.document.querySelector('#aes-language');select.value='fr';select.dispatchEvent(new p.w.Event('change'));
    assert.equal(select.value,'de');assert.equal(p.saved.aesLanguage,'de');assert.equal(select.disabled,false);
});
test('translated dashboard filters store stable operators and preserve airport values',async t=>{
    const schedule={type:'schedule',server:'paine',airline:{id:'42'},date:{20260917:{schedule:[{origin:'AAA',destination:'BBB',od:'AAABBB',direction:'Outbound',flightNumber:{100:{paxFreq:7,cargoFreq:0}}},{origin:'CCC',destination:'DDD',od:'CCCDDD',direction:'Outbound',flightNumber:{200:{paxFreq:7,cargoFreq:0}}}]}}};
    const p=browser(t,{html:config('de')+header+'<div class="bootstrap container-fluid"><h1>Dashboard</h1><div id="enterprise-dashboard"></div></div>',path:'/app/enterprise/dashboard',data:{settings:{general:{defaultDashboard:'routeManagement'}},paine42schedule:schedule}});
    p.load('content_dashboard.js');await until(()=>p.w.document.querySelector('#aes-row-AAABBB'));
    const form=p.w.$('.aes-dashboard-control-panel').filter((_,el)=>el.textContent.includes(catalogs.de['Apply filter']));
    const selects=form.find('tfoot select');selects.eq(0).val('aes-origin').trigger('change');selects.eq(1).val('contains');
    form.find('tfoot input').val('AAA');form.find('tfoot button').trigger('click');
    form.find('button').filter((_,el)=>el.textContent===catalogs.de['Apply filter']).trigger('click');
    await until(()=>p.saved.settings.routeManagement.filter.length===1);
    assert.equal(p.saved.settings.routeManagement.filter[0].operation,'contains');
    assert.equal(p.w.document.querySelector('#aes-row-AAABBB .aes-origin').textContent,'AAA');
    assert.equal(p.w.document.querySelector('#aes-row-CCCDDD').style.display,'none');
});
for(const locale of Object.keys(catalogs))test(`${locale}: schedule diff translates changes but keeps filter enums and airline names`,async t=>{
    const p=browser(t,{data:{aesLanguage:locale}});p.load('modules/schedule-diff.js');
    const freq={paxFreq:7,cargoFreq:0,services:[{days:'135',departure:'08:00',arrival:'10:00',aircraft:'A320',valid:'Now',remark:''}]};
    const capture=(id,flightNumber)=>({id,capturedAt:id==='new'?'2026-09-17T02:00:00Z':'2026-09-17T01:00:00Z',schedule:[{origin:'AAA',destination:'BBB',flightNumber}]});
    p.run(`AESScheduleDiff.open(${JSON.stringify({captures:{new:capture('new',{1:freq,2:freq}),old:capture('old',{1:{...freq,paxFreq:4}})}})},'Save')`);
    await until(()=>p.w.document.querySelectorAll('dialog tbody tr').length===2);
    const select=p.w.$('dialog select').eq(2);assert.equal(select.find('option').eq(1).val(),'Added');
    select.val('Added').trigger('change');
    assert.equal(p.w.document.querySelectorAll('dialog tbody tr').length,1);
    assert.equal(p.w.document.querySelector('dialog tbody td').textContent,catalogs[locale].Added);
    assert.ok(p.w.document.querySelector('dialog h3').textContent.endsWith('Save'));
    assert.match(p.w.document.querySelector('dialog tbody').textContent,/AAA → BBB/);
});
test('UI initialization waits for the stored language instead of briefly using the game language',t=>{
    const p=browser(t,{helpers:false,html:config('de')});
    let finish;p.w.chrome.storage.local.get=(_,callback)=>{finish=callback;};
    p.load('modules/i18n-data.js');p.load('modules/i18n.js');
    p.run(`window.rendered=false;AESI18n.whenReady(()=>{window.rendered=AESI18n.t('Save')});`);
    assert.equal(p.w.rendered,false);finish({aesLanguage:'ja'});assert.equal(p.w.rendered,catalogs.ja.Save);
});

for(const locale of Object.keys(catalogs))test(`${locale}: backend errors translate at presentation and preserve diagnostic details`,t=>{
    const p=browser(t,{data:{aesLanguage:locale}});
    assert.equal(p.run(`AESI18n.errorMessage('Invalid settings.')`),catalogs[locale]['Invalid settings.']);
    assert.equal(p.run(`AESI18n.errorMessage('Unable to save schedule: Disk full (E123)')`),catalogs[locale]['Unable to save schedule: {0}'].replace('{0}','Disk full (E123)'));
    assert.equal(p.run(`AESI18n.errorMessage('A user supplied value')`),'A user supplied value');
});

test('reload notice uses the selected language, including following the game after an override',t=>{
    const p=browser(t,{html:config('de'),data:{aesLanguage:'zh-TW'}});
    p.run('document.body.append(AESI18n.selector())');
    const select=p.w.document.querySelector('#aes-language'),status=p.w.document.querySelector('[role="status"]');
    for(const target of Object.keys(catalogs)){
        select.value=target;select.dispatchEvent(new p.w.Event('change'));
        assert.equal(status.textContent,catalogs[target]['Language saved. Reload this page to apply.']);
        assert.equal(status.lang,target);assert.equal(p.run('AESI18n.locale()'),'zh-TW');
    }
    select.value='auto';select.dispatchEvent(new p.w.Event('change'));
    assert.equal(status.textContent,catalogs.de['Language saved. Reload this page to apply.']);assert.equal(status.lang,'de');
    p.failures.set='Disk full';select.value='ja';select.dispatchEvent(new p.w.Event('change'));
    assert.equal(select.value,'auto');assert.equal(status.lang,'zh-TW');
    assert.equal(status.textContent,catalogs['zh-TW']['Unable to save language. Please try again.']);
});

test('extension language notice follows the cached game language instead of its overridden document language',t=>{
    const p=browser(t,{helpers:false,data:{aesLanguage:'ja',aesGameLanguage:'pl'}});
    p.load('modules/i18n-data.js');p.load('modules/i18n.js');
    p.w.document.documentElement.lang='ja';
    p.run('document.body.append(AESI18n.selector())');
    const select=p.w.document.querySelector('#aes-language');select.value='auto';select.dispatchEvent(new p.w.Event('change'));
    assert.equal(p.w.document.querySelector('[role="status"]').textContent,catalogs.pl['Language saved. Reload this page to apply.']);
});
