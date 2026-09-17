const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('./support/browser.cjs');
const service=(days='1234567',arrival='10:00')=>({days,departure:'08:00',arrival,aircraft:'A320',valid:'Now',remark:''});
const frequency=(services=[service()])=>({paxFreq:7,cargoFreq:0,valid:'Now',remark:'',services});
const capture=(flightNumber)=>({id:'x',label:'Snapshot',schedule:[{origin:'AAA',destination:'BBB',flightNumber}]});
function setup(t){const p=browser(t);p.load('modules/schedule-diff.js');return p;}
const compare=(p,a,b)=>p.run(`AESScheduleDiff.compare(${JSON.stringify(a)},${JSON.stringify(b)})`);

test('diff detects added, removed, time, equipment and weekday changes without row-order noise',t=>{
    const p=setup(t);
    const a=capture({1:frequency(),2:frequency(),3:frequency([service('135'),service('246')])});
    const b=capture({1:frequency([service('1234567','10:20')]),4:frequency(),3:frequency([service('246'),service('135')])});
    const result=compare(p,a,b);
    assert.deepEqual(Array.from(result.changes,c=>[c.flight,c.kind]),[['1','Changed'],['2','Removed'],['4','Added']]);
    assert.equal(result.limited,false);
    for(const field of ['days','aircraft']){
        const next=capture({1:frequency()});next.schedule[0].flightNumber[1].services[0][field]='different';
        assert.equal(compare(p,capture({1:frequency()}),next).changes[0].kind,'Changed');
    }
});

test('legacy snapshots compare frequencies without inventing new timing changes',t=>{
    const p=setup(t),old=frequency();delete old.services;
    let result=compare(p,capture({1:old}),capture({1:frequency()}));
    assert.equal(result.changes.length,0);assert.equal(result.limited,true);
    const changed=frequency();changed.paxFreq=4;
    assert.equal(compare(p,capture({1:old}),capture({1:changed})).changes.length,1);
});

test('comparison dialog supports filters and search and uses text for airline names',t=>{
    const p=setup(t);
    p.w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    const raw={captures:{new:{...capture({1:frequency(),2:frequency()}),id:'new',date:'20260917',capturedAt:'2026-09-17T02:00:00Z'},old:{...capture({1:{...frequency(),paxFreq:4}}),id:'old',date:'20260917',capturedAt:'2026-09-17T01:00:00Z'}},date:{}};
    p.run(`AESScheduleDiff.open(${JSON.stringify(raw)},'<img src=x>')`);
    assert.ok(p.w.document.querySelector('dialog[open]'));
    assert.equal(p.w.document.querySelector('dialog img'),null);
    assert.equal(p.w.document.querySelectorAll('dialog tbody tr').length,2);
    p.w.$('[aria-label="Change type"]').val('Added').trigger('change');
    assert.equal(p.w.document.querySelectorAll('dialog tbody tr').length,1);
    assert.match(p.w.document.querySelector('dialog tbody').textContent,/Added/);
    p.w.$('[aria-label="Search changes"]').val('nonexistent').trigger('input');
    assert.match(p.w.document.querySelector('dialog tbody').textContent,/No changes match/);
    p.w.$('dialog button').first().trigger('click');assert.equal(p.w.document.querySelector('dialog'),null);
});

test('schedule collection keeps detailed operating patterns for repeated flight numbers',async t=>{
    const p=setup(t);
    const html='<div class="flight-schedule"><table><thead><tr><th>Code</th><th>Days</th><th>Departure</th><th>Arrival</th><th>Aircraft</th></tr></thead><tbody><tr class="important origin"><td><a>AAA</a></td></tr><tr class="destination"><td><a>BBB</a></td></tr>'+['135','246'].map(days=>`<tr><td class="code">OA 10</td><td class="days">${days}</td><td>08:00</td><td>10:00 +1</td><td>A320</td></tr>`).join('')+'</tbody></table></div>';
    const data=await p.run(`AESRead.parseSchedule(new DOMParser().parseFromString(${JSON.stringify(html)},'text/html'),()=>{},()=>true)`);
    const flight=data[0].flightNumber[10];
    assert.equal(flight.paxFreq,6);assert.equal(flight.services.length,2);
    assert.equal(flight.services[0].departure,'08:00');assert.equal(flight.services[0].arrival,'10:00 +1');assert.equal(flight.services[0].aircraft,'A320');
});
