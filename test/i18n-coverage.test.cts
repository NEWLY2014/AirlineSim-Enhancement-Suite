const {test}=(require('node:test') as typeof import('node:test'));
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const {auditSource,auditProject}=(require('../scripts/audit-i18n.cts') as import('../scripts/audit-i18n.cts').API);
test('all first-party scripts and extension pages have reviewed localization coverage',()=>{
    assert.deepEqual(auditProject(),[]);
});
test('coverage guard catches indirect prose, metadata, templates, markup and bypassed translation',()=>{
    const catalog={Save:'Save'};
    for(const source of [
        `const message='Currently '+count+' aircrafts stored in memory.';`,
        `const columns=[{name:'Previously unreviewed column'}];`,
        'const message=`Unable to schedule ${flight} at ${time}`;',
        `const html='<button title="A newly added tooltip">New action</button>';`,
        `button.text('Save');`,
        `AESI18n.t('Missing translation key');`
    ])assert.ok(auditSource(source,{catalog}).length,source);
    assert.deepEqual(auditSource(`button.text(AESI18n.t('Save'));document.querySelector('.a > .b');`,{catalog}),[]);
});
test('every explicit audit exemption has a review reason',()=>{
    for(const [text,reason] of Object.entries((require('../scripts/i18n-exemptions.json') as Record<string,string>)))assert.ok(reason.length>20,text);
});
