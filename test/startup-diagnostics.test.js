const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {JSDOM}=require('jsdom');
const source=readFileSync('build/extension/modules/startup-diagnostics.js','utf8');
function page(t,lang='en'){
 const dom=new JSDOM(`<html lang="${lang}"><body><main>Game</main></body></html>`,{url:'https://paine.airlinesim.aero/app/enterprise/dashboard?secret=hidden#private',runScripts:'outside-only'});
 t.after(()=>dom.window.close());const w=dom.window;
 w.chrome={runtime:{getManifest:()=>({version:'0.9.0.10'}),getURL:p=>'chrome-extension://aes/'+p},storage:{local:{}}};
 w.eval(source);return w;
}
test('missing helpers render independently, deduplicate and retain dismissal',t=>{
 const w=page(t);w.AESStartup.check();w.AESStartup.check();
 assert.equal(w.document.querySelectorAll('#aes-startup-error').length,1);
 assert.match(w.document.body.textContent,/shared components/);
 w.document.querySelectorAll('button')[2].click();w.AESStartup.check();
 assert.equal(w.document.querySelector('#aes-startup-error'),null);
});
test('diagnostics omit query and fragment and copy only on click',async t=>{
 const w=page(t);let copied;
 Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>{copied=text;}}});
 w.AESStartup.report('dashboard',new w.Error('Failed https://paine.airlinesim.aero/app/test?token=secret#fragment'));
 assert.equal(copied,undefined);w.document.querySelectorAll('button')[1].click();await Promise.resolve();
 const d=JSON.parse(copied);assert.equal(d.page,'https://paine.airlinesim.aero/app/enterprise/dashboard');
 assert.ok(!copied.includes('secret'));assert.ok(!copied.includes('fragment'));assert.equal(d.sharedComponentsAvailable,false);
});
test('copy rejection offers a selectable readonly fallback',async t=>{
 const w=page(t,'zh-TW');w.AESStartup.check();
 assert.match(w.document.body.textContent,/共用元件/);
 w.document.querySelectorAll('button')[1].click();await Promise.resolve();
 const field=w.document.querySelector('textarea');assert.ok(field.readOnly);assert.match(field.value,/AES_STARTUP_SHARED/);
});
test('all supported languages have independent startup translations',t=>{
 for(const lang of ['de','es','fr','hu','nl','pl','zh-TW','ja']){
 const w=page(t,lang);w.AESStartup.check();assert.ok(!w.document.body.textContent.includes('shared components are unavailable'),lang);
 }
});
test('only extension errors are reported and healthy helpers stay quiet',t=>{
 const w=page(t);w.AES=function(){};w.AESStartup.check();assert.equal(w.document.querySelector('#aes-startup-error'),null);
 w.dispatchEvent(new w.ErrorEvent('error',{filename:'https://paine.airlinesim.aero/game.js',message:'game error'}));
 assert.equal(w.document.querySelector('#aes-startup-error'),null);
 w.dispatchEvent(new w.ErrorEvent('error',{filename:'chrome-extension://aes/content_dashboard.js',error:new w.Error('boom')}));
 assert.match(w.document.body.textContent,/feature could not start/);
});
test('recognized failure categories and unavailable storage',t=>{
 const w=page(t);assert.equal(w.AESStartup.classify(new w.Error('Extension context invalidated.')),'updated');
 assert.equal(w.AESStartup.classify('Dashboard insertion target #enterprise-dashboard was not found'),'target');
 w.AES=function(){};delete w.chrome.storage;w.AESStartup.check();assert.match(w.document.body.textContent,/saved data/);
});
