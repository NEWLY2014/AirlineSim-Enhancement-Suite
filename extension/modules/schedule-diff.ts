/** Read historical schedules without changing the legacy daily backup format. */
namespace AESScheduleDiff {
    export interface Capture {id:string; label:string; order?:string; schedule:AESModel.ScheduleRoute[]}
    export interface Change {kind:'Added'|'Removed'|'Changed'; route:string; flight:string; before:string; after:string}
    const record = (value: unknown): value is Record<string,unknown> => !!value && typeof value==='object' && !Array.isArray(value);
    export function captures(raw: unknown): Capture[] {
        if (!record(raw)) return [];
        const result: Capture[]=[];
        const add=(value:unknown,id:string,date:string)=>{
            if (!record(value) || !Array.isArray(value.schedule) || !value.schedule.length) return;
            const routes=value.schedule.filter((route): route is AESModel.ScheduleRoute => record(route) && typeof route.origin==='string' && typeof route.destination==='string' && record(route.flightNumber));
            if (routes.length!==value.schedule.length) return;
            const timestamp=typeof value.capturedAt==='string' ? value.capturedAt : '';
            const label=timestamp ? timestamp.replace('T',' ').replace('Z',' UTC') : date+' '+String(value.updateTime || AESI18n.t('(daily snapshot)'));
            const order=timestamp || String(value.date || date).replace(/-/g,'').slice(0,8).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')+'T'+String(value.updateTime || '00:00').slice(0,5)+':00.000Z';
            result.push({id:typeof value.id==='string' ? value.id : id,label,order,schedule:routes});
        };
        if (record(raw.captures)) for (const [id,value] of Object.entries(raw.captures)) add(value,id,record(value) ? String(value.date || '') : '');
        // Legacy daily snapshots remain selectable without rewriting the backup.
        if (record(raw.date)) for (const date of Object.keys(raw.date).filter(key=>/^\d{8}$/.test(key)).sort().reverse()) {
            const value=raw.date[date];
            if (record(raw.captures) && Object.values(raw.captures).some(capture=>record(capture) && capture.date===date)) continue;
            add(value,'daily:'+date,date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6));
        }
        result.reverse();
        result.sort((a,b)=>(b.order || '').localeCompare(a.order || ''));
        return result;
    }
    const pause=()=>AES.yieldToPage();
    function checkpoint(current:()=>boolean) {
        let deadline=performance.now()+8;
        return async()=>{
            if (!current()) throw new Error(AESI18n.t("Comparison cancelled."));
            if (performance.now()>=deadline) {await pause();deadline=performance.now()+8;}
            if (!current()) throw new Error(AESI18n.t("Comparison cancelled."));
        };
    }
    async function index(capture:Capture,check:()=>Promise<void>) {
        const flights=new Map<string,{route:string;flight:string;data:AESModel.ScheduleFrequency}>();
        let processed=0;
        for (const route of capture.schedule) for (const flight of Object.keys(route.flightNumber)) {
            const data=route.flightNumber[flight];
            if (!record(data)) continue;
            const key=JSON.stringify([route.origin,route.destination,flight]);
            flights.set(key,{route:route.origin+' → '+route.destination,flight,data});
            if (++processed%128===0) await check();
        }
        return flights;
    }
    const patterns=(data:AESModel.ScheduleFrequency,fields:string[]) => (Array.isArray(data.services) ? data.services.filter(record) : []).map(service=>
        fields.map(field=>String((service as unknown as Record<string,unknown>)[field] ?? '')).join(' · ')).sort();
    function summary(data:AESModel.ScheduleFrequency,fields:string[]) {
        const labels:Record<string,string>={days:'Days',departure:'Depart',arrival:'Arrive',aircraft:'Aircraft',valid:'Valid',remark:'Note'};
        const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        const details=Array.isArray(data.services) ? data.services.filter(record).map(service=>fields.map(field=>{
            let value=String((service as unknown as Record<string,unknown>)[field] ?? '');
            if (!value) return '';
            if (field==='days') value=value.split('').map(day=>AESI18n.t(days[Number(day)-1] || day)).join(' ');
            return AESI18n.t(labels[field])+': '+value;
        }).filter(Boolean).join(' · ')).sort().join('\n') : [data.valid,data.remark].filter(Boolean).join(' · ');
        return AESI18n.t('{0} passenger / {1} cargo per week', {0:data.paxFreq,1:data.cargoFreq})+(details ? '\n'+details : '');
    }
    export async function compare(before:Capture,after:Capture,current:()=>boolean=()=>true): Promise<{changes:Change[];limited:boolean}> {
        await pause();
        const check=checkpoint(current);
        await check();
        const old=await index(before,check), next=await index(after,check), changes:Change[]=[];
        let processed=0;
        let limited=false;
        // Walk each map directly to avoid allocating a second full union of keys.
        function* keys() {yield* old.keys();for(const key of next.keys()) if(!old.has(key)) yield key;}
        for (const key of keys()) {
            if (++processed%128===0) await check();
            const a=old.get(key),b=next.get(key),item=b || a!;
            const fields=['days','departure','arrival','aircraft','valid','remark'].filter(field=>{
                const available=(data:AESModel.ScheduleFrequency)=>Array.isArray(data.services) && data.services.length>0 && data.services.every(service=>record(service) && typeof service[field]==='string');
                return (!a || available(a.data)) && (!b || available(b.data));
            });
            if (a && b && fields.length<6) limited=true;
            const signature=(data:AESModel.ScheduleFrequency)=>JSON.stringify([Number(data.paxFreq)||0,Number(data.cargoFreq)||0,fields.includes('valid') ? '' : data.valid || '',fields.includes('remark') ? '' : data.remark || '',fields.length ? patterns(data,fields) : []]);
            if (a && b && signature(a.data)===signature(b.data)) continue;
            changes.push({kind:!a ? 'Added' : !b ? 'Removed' : 'Changed',route:item.route,flight:item.flight,
                before:a ? summary(a.data,fields) : '—',after:b ? summary(b.data,fields) : '—'});
        }
        const collator=new Intl.Collator(undefined,{numeric:true});
        const order=(a:Change,b:Change)=>collator.compare(a.route,b.route)||collator.compare(a.flight,b.flight);
        // Bottom-up merge sort also yields; native sorting would still be one long task.
        let sorted=changes, target=new Array<Change>(changes.length);
        for(let width=1;width<changes.length;width*=2){
            for(let start=0;start<changes.length;start+=2*width){
                let left=start,right=Math.min(start+width,changes.length);
                const middle=right,end=Math.min(start+2*width,changes.length);
                for(let out=start;out<end;out++){
                    target[out]=left<middle && (right>=end || order(sorted[left],sorted[right])<=0) ? sorted[left++] : sorted[right++];
                    if (++processed%128===0) await check();
                }
            }
            [sorted,target]=[target,sorted];
        }
        await check();
        return {changes:sorted,limited};
    }

    let activeDialog: JQuery | undefined;
    let cleanupRegistered=false;
    export function open(raw:unknown,name:string,returnFocus:HTMLElement | undefined=document.activeElement instanceof HTMLElement ? document.activeElement : undefined) {
        activeDialog?.remove();
        const items=captures(raw);
        const dialog=$(AESI18n.html('<dialog class="aes-schedule-diff" aria-label="Schedule changes"></dialog>'));
        const theme=AES.getFrontendSettings().theme;
        dialog.attr('lang',AESI18n.locale());
        dialog.attr('data-theme',theme==='light' || theme==='classic' ? 'light' : 'dark');
        const close=$(AESI18n.html('<button type="button" class="btn btn-default">Close</button>'));
        dialog.append($('<div class="aes-diff-heading"></div>').append($('<h3></h3>').text(AESI18n.t("Schedule changes · {0}", {"0": name})),close));
        activeDialog=dialog;
        const destroy=()=>{
            if ((dialog[0] as HTMLDialogElement).open) (dialog[0] as HTMLDialogElement).close();
            dialog.remove();if(activeDialog===dialog)activeDialog=undefined;
            if(returnFocus?.isConnected) returnFocus.focus();
        };
        close.on('click',destroy);dialog.on('cancel',event=>{event.preventDefault();destroy();});
        if (!cleanupRegistered) {AES.whenPageOwnershipLost(()=>{activeDialog?.remove();activeDialog=undefined;});cleanupRegistered=true;}
        const show=()=>{document.body.append(dialog[0]);(dialog[0] as HTMLDialogElement).showModal();close.trigger('focus');};
        if (items.length<2) {
            dialog.append($('<p></p>').text(AESI18n.t('A comparison needs two saved schedules. Refresh this airline again after its schedule changes.')));show();return;
        }
        const older=$(AESI18n.html('<select class="form-control" aria-label="Previous snapshot"></select>'));
        const newer=$(AESI18n.html('<select class="form-control" aria-label="Current snapshot"></select>'));
        items.forEach((item,i)=>{older.append($('<option></option>').val(i).text(item.label));newer.append($('<option></option>').val(i).text(item.label));});
        older.val(1);newer.val(0);
        const filter=$(AESI18n.html('<select class="form-control" aria-label="Change type"><option>All changes</option><option>Added</option><option>Removed</option><option>Changed</option></select>'));
        const search=$(AESI18n.html('<input class="form-control" type="search" placeholder="Flight number or airport" aria-label="Search changes">'));
        dialog.append($('<div class="aes-diff-controls"></div>').append(
            $(AESI18n.html('<label>From</label>')).append(older),$(AESI18n.html('<label>To</label>')).append(newer),$(AESI18n.html('<label>Show</label>')).append(filter),$(AESI18n.html('<label>Search</label>')).append(search)));
        const status=$('<p role="status" class="aes-diff-summary"></p>'),note=$('<p class="text-muted"></p>');
        const body=$('<tbody></tbody>');
        const table=$(AESI18n.html('<table class="table table-bordered"><thead><tr><th>Change</th><th>Route</th><th>Flight</th><th>Before</th><th>After</th></tr></thead></table>')).append(body);
        const prev=$(AESI18n.html('<button type="button" class="btn btn-default">Previous</button>')),next=$(AESI18n.html('<button type="button" class="btn btn-default">Next</button>')),pageLabel=$('<span></span>');
        dialog.append(status,note,$('<div class="aes-diff-table"></div>').append(table),$('<div class="aes-diff-pagination"></div>').append(prev,pageLabel,next),$('<p class="text-muted"></p>').text(AESI18n.t('Every successful collection is retained until you manually clear history in AES options. Flight number changes appear as removals and additions.')));
        let page=0;
        let result: Awaited<ReturnType<typeof compare>> | undefined;
        let revision=0, renderRevision=0;
        let searchIndex: Array<{change:Change;text:string}> = [];
        let totals = {Added:0,Removed:0,Changed:0};
        let cachedFilter = '', cachedRows: Change[] = [];
        const render=async()=>{
            const request = ++renderRevision;
            body.empty();
            const valid=Number(older.val())>Number(newer.val());
            if (!valid) {status.text(AESI18n.t('Choose a From snapshot older than the To snapshot.'));note.text('');prev.prop('disabled',true);next.prop('disabled',true);pageLabel.text('');return;}
            const comparison=result;
            if (!comparison) {status.text(AESI18n.t('Comparing schedules…'));note.text('');prev.prop('disabled',true);next.prop('disabled',true);pageLabel.text('');return;}
            const query=String(search.val() || '').trim().toLowerCase();
            const kind = String(filter.val());
            const filterKey = JSON.stringify([kind,query]);
            let rows = cachedRows;
            if (cachedFilter !== filterKey) {
                rows = [];
                let deadline = performance.now()+8;
                for (let i=0;i<searchIndex.length;i++) {
                    if (i%128===0 && performance.now()>=deadline) {
                        await AES.yieldToPage();deadline=performance.now()+8;
                        if (request!==renderRevision || activeDialog!==dialog || !dialog[0].isConnected) return;
                    }
                    const item = searchIndex[i];
                    if ((kind==='All changes' || item.change.kind===kind) && item.text.includes(query)) rows.push(item.change);
                }
                cachedRows=rows;cachedFilter=filterKey;
            }
            status.text(comparison.changes.length ? AESI18n.t("{0} added · {1} removed · {2} changed", {"0": totals.Added, "1": totals.Removed, "2": totals.Changed}) : AESI18n.t('No changes in comparable fields.'));
            note.text(comparison.limited ? AESI18n.t('Some snapshots lack detailed fields. Only fields available in both snapshots are compared.') : '');
            for (const change of rows.slice(page*100,(page+1)*100)) body.append($('<tr></tr>').append(...[AESI18n.t(change.kind),change.route,change.flight,change.before,change.after].map(value=>$('<td></td>').text(value))));
            if (!rows.length && comparison.changes.length) body.append($('<tr></tr>').append($('<td colspan="5"></td>').text(AESI18n.t('No changes match your filters.'))));
            prev.prop('disabled',page===0);next.prop('disabled',(page+1)*100>=rows.length);
            pageLabel.text(rows.length ? AESI18n.t("{0}–{1} of {2}", {"0": (page*100+1), "1": Math.min((page+1)*100,rows.length), "2": rows.length}) : AESI18n.t('0 changes'));
        };
        const refresh=async()=>{
            const request=++revision;page=0;result=undefined;cachedFilter='';cachedRows=[];void render();
            if(Number(older.val())<=Number(newer.val())) return;
            const current=()=>activeDialog===dialog && dialog[0].isConnected && revision===request;
            try {
                const compared=await compare(items[Number(older.val())],items[Number(newer.val())],current);
                const index: typeof searchIndex = [], counts={Added:0,Removed:0,Changed:0};
                const check=checkpoint(current);
                for(let i=0;i<compared.changes.length;i++) {
                    if(i%128===0) await check();
                    const change=compared.changes[i];counts[change.kind]++;
                    index.push({change,text:(change.route+' '+change.flight).toLowerCase()});
                }
                if(current()){searchIndex=index;totals=counts;result=compared;await render();}
            } catch(error) {if(current()) status.text(AESI18n.t("Unable to compare schedules: {0}", {"0": String(error)}));}
        };
        older.add(newer).on('change',()=>{void refresh();});
        filter.on('change',()=>{page=0;void render();});search.on('input',()=>{page=0;void render();});
        prev.on('click',()=>{page--;void render();});next.on('click',()=>{page++;void render();});show();void refresh();
    }
}
