const {test}=(require('node:test') as typeof import('node:test'));
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const {JSDOM}=(require('jsdom') as typeof import('jsdom'));
const {enterprise}=(require('./support/read-pages.cts') as import('./support/read-pages.cts').API);

test('enterprise fixtures preserve each supported tab and its content',()=>{
    for(const [tab,selector] of [['0','.as-fieldset'],['2','.tab-content'],['3','.flight-schedule']]){
        const dom=new JSDOM(enterprise(tab));
        try{
            assert.equal(dom.window.document.querySelector('.nav-tabs .active')?.className,`tab${tab} active`);
            assert.ok(dom.window.document.querySelector(selector));
        }finally{dom.window.close();}
    }
});

test('enterprise fixtures fall back to overview without reflecting unsupported or malicious tabs',()=>{
    const fallback=enterprise('0');
    for(const tab of [null,'','1','03','2extra',' 3','\"><script>document.documentElement.dataset.aesInjected="true"</script><li class="','\" onclick="alert(1)']){
        assert.equal(enterprise(tab),fallback,`Unexpected tab: ${String(tab)}`);
    }
});
