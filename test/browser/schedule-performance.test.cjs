const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const {mkdtemp,rm,readFile}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {createServer}=require('node:https');
const {execFileSync}=require('node:child_process');

test('large schedule extraction yields to the page and preserves history through background storage', {timeout:60000}, async t=>{
    const profile=await mkdtemp(join(tmpdir(),'aes-schedule-browser-'));
    const extension=resolve(process.env.AES_TEST_EXTENSION || 'build/extension');
    let context,server;
    t.after(async()=>{
        if(context)await context.close();
        if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
        await rm(profile,{recursive:true,force:true});
    });
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(profile,'key.pem'),'-out',join(profile,'cert.pem'),'-days','1','-subj','/CN=paine.airlinesim.aero'],{stdio:'ignore'});
    const flights=10000;
    const rows=Array.from({length:flights},(_,i)=>`<tr><td class="code">OA ${i}</td><td class="days">1234567</td><td class="remarks"></td><td class="valid">Now</td></tr>`).join('');
    const html=`<script>window.frontendSettings = {"fixedEnterpriseId":42,"server":{"time":"2026-09-08T00:00:00Z"}};</script>
        <div id="header"><div><button aria-haspopup="menu"><span class="_name_test">AES Airlines</span></button><div role="menubar"></div></div></div>
        <div class="bootstrap container-fluid"><h1>Enterprises</h1><div><h2><span>Other Air</span></h2><div class="as-panel"><ul class="nav-tabs"><li class="tab3 active">Schedule</li></ul>
        <div class="flight-schedule"><table><tbody><tr class="important origin"><td><a>AAA</a></td></tr><tr class="destination"><td><a>BBB</a></td></tr>${rows}</tbody></table></div></div></div></div>`;
    server=createServer({key:await readFile(join(profile,'key.pem')),cert:await readFile(join(profile,'cert.pem'))},(req,res)=>{
        req.resume();res.writeHead(200,{'Content-Type':'text/html'});res.end(html);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,ignoreHTTPSErrors:true,args:[
        `--disable-extensions-except=${extension}`,`--load-extension=${extension}`,
        `--host-resolver-rules=MAP * 127.0.0.1:${server.address().port}`,'--no-proxy-server','--ignore-certificate-errors']});
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    await worker.evaluate(async flights=>{
        const flightNumber=Object.fromEntries(Array.from({length:flights},(_,i)=>[i,{paxFreq:7,cargoFreq:0,remark:'',valid:'Now'}]));
        const schedule=[{origin:'AAA',destination:'BBB',od:'AAABBB',direction:'Outbound',flightNumber}];
        const date=Object.fromEntries(Array.from({length:30},(_,i)=>['202608'+String(i+1).padStart(2,'0'),{date:'202608'+String(i+1).padStart(2,'0'),updateTime:'00:00 UTC',schedule}]));
        await chrome.storage.local.set({settings:{},paine99schedule:{type:'schedule',server:'paine',airline:{id:'99'},date,extra:'preserved'}});
    },flights);
    const page=await context.newPage();
    await page.goto('https://paine.airlinesim.aero/app/info/enterprises/99?tab=3');
    await page.locator('#aes-extractSchedule-btn').waitFor();
    const result=await page.evaluate(()=>new Promise(resolve=>{
        let beats=0,paintedProgress=0,maxTimerGapMs=0,clickBlockingMs=0;const progressStates=new Set();const longTasks=[];
        const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>e.duration)));
        observer.observe({type:'longtask'});
        const frame=()=>{const text=document.querySelector('#aes-schedule-status')?.textContent;if(text?.includes('rows processed')){paintedProgress++;progressStates.add(text);}raf=requestAnimationFrame(frame);};
        let raf=requestAnimationFrame(frame);
        const started=performance.now();let lastBeat=started;
        const timer=setInterval(()=>{
            const now=performance.now();maxTimerGapMs=Math.max(maxTimerGapMs,now-lastBeat);lastBeat=now;beats++;
            const status=document.querySelector('#aes-schedule-status');
            if(status?.textContent==='Schedule extracted!' || status?.classList.contains('bad')){
                clearInterval(timer);cancelAnimationFrame(raf);
                setTimeout(()=>{observer.disconnect();resolve({elapsedMs:performance.now()-started,beats,paintedProgress,progressUpdates:progressStates.size,clickBlockingMs,maxTimerGapMs,maxLongTaskMs:Math.max(0,...longTasks),status:status.textContent});},100);
            }
        },5);
        document.querySelector('#aes-extractSchedule-btn').click();
        clickBlockingMs=performance.now()-started;
    }));
    t.diagnostic(JSON.stringify({flights,historyDays:30,...result}));
    assert.equal(result.status,'Schedule extracted!');
    assert.ok(result.progressUpdates>1,'the browser must render multiple extraction progress updates before completion');
    assert.ok(result.beats>5,'page timers must continue while extraction is in progress');
    const stored=await worker.evaluate(async()=>{
        const value=(await chrome.storage.local.get('paine99schedule')).paine99schedule;
        return {dates:Object.keys(value.date).length,extra:value.extra,
            flights:Object.keys(value.date['20260908'].schedule[0].flightNumber).length,
            first:value.date['20260908'].schedule[0].flightNumber['0'],
            historyFlights:Object.keys(value.date['20260801'].schedule[0].flightNumber).length};
    });
    assert.deepEqual(stored,{dates:31,extra:'preserved',flights,historyFlights:flights,first:{paxFreq:7,cargoFreq:0,remark:'',valid:'Now'}});
});
