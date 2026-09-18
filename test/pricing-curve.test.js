const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('./support/browser.cjs');
const points=[{load:0,change:-15},{load:60,change:-5},{load:85,change:0},{load:95,change:3},{load:100,change:6}];
function curve(t){const p=browser(t);p.load('modules/inventory/curve.js');return p;}
test('control points interpolate continuously, retain fractional loads and support flat regions',t=>{
    const p=curve(t);p.w.points=points;
    for(const [load,expected] of [[0,-15],[60,-5],[72.5,-2.5],[85,0],[90,1.5],[91.5,1.95],[98,4.8],[100,6]]){
        p.w.load=load;assert.ok(Math.abs(p.run('AESPricingCurve.interpolate(window.points,window.load)')-expected)<1e-12);
    }
    p.w.points=[{load:0,change:-5},{load:85,change:0},{load:90,change:0},{load:100,change:5}];
    assert.equal(p.run('AESPricingCurve.interpolate(window.points,87.25)'),0);
});
test('final prices round once and integer limits round inward',t=>{
    const p=curve(t);
    assert.equal(p.run('AESPricingCurve.price(164,137,1.95,60,200)'),167);
    assert.equal(p.run('AESPricingCurve.price(100,100,0.5,60,200)'),101);
    assert.equal(p.run('AESPricingCurve.price(100,100,-0.5,60,200)'),100);
    assert.equal(p.run('AESPricingCurve.price(164,137,100,60,130)'),178);
    assert.equal(p.run('AESPricingCurve.price(164,137,-100,60,130)'),83);
    assert.equal(p.run('AESPricingCurve.price(100,137,0.01,60,130)'),100);
    assert.equal(p.run('AESPricingCurve.price(1,1,0,60,70)'),null);
    assert.equal(p.run('AESPricingCurve.price(100,0,1,60,200)'),null);
    // 0.1% of 1000 should be exactly 1 despite floating-point representation.
    assert.equal(p.run('AESPricingCurve.price(100,1000,0,0.1,0.3)'),3);
});
test('point validation sorts copies and rejects gaps, duplicates and invalid numbers',t=>{
    const p=curve(t);p.w.points=[...points].reverse();
    assert.deepEqual(JSON.parse(p.run('JSON.stringify(AESPricingCurve.points(window.points))')),points);
    assert.equal(p.w.points[0].load,100);
    for(const invalid of [[],[{load:0,change:0}],points.slice(1),[...points,{load:60,change:1}],[{load:0,change:NaN},{load:100,change:0}],[{load:0,change:0},{load:101,change:1}]]){
        p.w.points=invalid;assert.equal(p.run('AESPricingCurve.points(window.points)'),null);
    }
});

test('adding a point preserves the curve and leaves endpoints fixed',t=>{
    const p=curve(t);p.load('modules/inventory/curve-editor.js');
    p.run("window.editor=AESCurveEditor.mount($('<div id=\"editor\"></div>').appendTo(document.body),[{load:0,change:-10},{load:100,change:10}])");
    const $=p.w.$;
    $('#editor > button').trigger('click');
    assert.deepEqual(JSON.parse(p.run('JSON.stringify(window.editor.read())')),[{load:0,change:-10},{load:50,change:0},{load:100,change:10}]);
    const rows=$('.aes-curve-table tbody tr');
    assert.equal(rows.first().find('button').prop('disabled'),true);assert.equal(rows.last().find('button').prop('disabled'),true);
    rows.eq(1).find('button').trigger('click');assert.equal($('.aes-curve-table tbody tr').length,2);
});
