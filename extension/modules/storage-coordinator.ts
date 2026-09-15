/** One transaction queue for background read/merge/write operations. */
class AESStorage {
    private static pending: Array<() => void> = [];
    private static busy = false;
    static enqueue(action: (finish: () => void) => void) {
        this.pending.push(() => action(() => {this.busy=false;this.drain();}));
        this.drain();
    }
    static run<T>(action: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve,reject) => this.enqueue(finish => {
            let result: Promise<T>;
            try {result=action();} catch(error) {result=Promise.reject(error);}
            void result.then(resolve,reject).finally(finish);
        }));
    }
    private static drain() {
        if (this.busy || !this.pending.length) return;
        this.busy=true;
        this.pending.shift()!();
    }
    static merge(before: unknown, after: unknown, current: unknown): unknown {
        const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
        const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
        if (current === undefined && (before === undefined || (Array.isArray(before) && !before.length))) return after;
        if (equal(before, after)) return current;
        if (equal(current, before) || equal(current, after)) return after;
        if (record(after) && (before === undefined || record(before)) && record(current)) {
            const result = {...current};
            for (const key of new Set([...Object.keys(before || {}), ...Object.keys(after)])) {
                if (['__proto__','constructor','prototype'].includes(key)) throw new Error('Invalid record field.');
                const value = this.merge(before?.[key], after[key], current[key]);
                if (value === undefined) delete result[key]; else result[key] = value;
            }
            return result;
        }
        if (Array.isArray(before) && Array.isArray(after) && Array.isArray(current)) {
            if ([...before,...after,...current].every(v => typeof v === 'string')) {
                const removed = before.filter(v => !after.includes(v));
                return [...new Set([...current.filter(v => !removed.includes(v)), ...after.filter(v => !before.includes(v))])];
            }
            const keyed = (values: unknown[]): values is Array<Record<string, unknown>> => values.every(v => record(v) && v.aircraftId != null) && new Set(values.map(v => String((v as Record<string,unknown>).aircraftId))).size === values.length;
            if (keyed(before) && keyed(after) && keyed(current)) {
                const index = (values: Array<Record<string,unknown>>) => Object.fromEntries(values.map(v => [String(v.aircraftId), v]));
                return Object.values(this.merge(index(before), index(after), index(current)) as Record<string,unknown>);
            }
        }
        throw new Error('This record changed in another page. Refresh before retrying.');
    }
}
/** Background-only mutations. Keep read/compare/write in one worker queue. */
(() => {
    const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
    function enqueue(action: (finish: () => void) => void) {
        AESStorage.enqueue(action);
    }
    const getLocal = (key: string) => new Promise<Record<string, unknown>>((resolve, reject) => chrome.storage.local.get(key, data => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve(data);
    }));
    const setLocal = (data: Record<string, unknown>) => new Promise<void>((resolve, reject) => chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve();
    }));
    const removeLocal = (key: string) => new Promise<void>((resolve, reject) => chrome.storage.local.remove(key, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve();
    }));
    chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
        if (!record(message) || message.type !== 'AES_PRUNE_HISTORY') return false;
        if (sender.id !== chrome.runtime.id || sender.url !== 'chrome-extension://' + chrome.runtime.id + '/options.html') {
            reply({ok:false,error:'Open AES options to clean history.'});return false;
        }
        void AESStorage.run(async () => {
            const stored = await new Promise<Record<string,unknown>>((resolve,reject) => chrome.storage.local.get(null, data => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));else resolve(data);
            }));
            const cutoff = new Date();cutoff.setDate(cutoff.getDate()-30);
            const old = (value: unknown) => {
                if (typeof value !== 'string' && typeof value !== 'number') return false;
                const text=String(value);
                const date=/^\d{8}$/.test(text) ? new Date(Number(text.slice(0,4)),Number(text.slice(4,6))-1,Number(text.slice(6,8))) : new Date(text);
                if (/^\d{8}$/.test(text) && (date.getFullYear()!==Number(text.slice(0,4)) || date.getMonth()+1!==Number(text.slice(4,6)) || date.getDate()!==Number(text.slice(6,8)))) return false;
                return Number.isFinite(date.getTime()) && date.getTime()<cutoff.getTime();
            };
            const updates: Record<string,unknown> = {}, removals: string[] = [];
            let snapshots=0;
            for (const [key,item] of Object.entries(stored)) {
                if (key==='settings' || key==='aesRestoreRecoveryV1' || !record(item)) continue;
                if (key.startsWith('aesLog_') || item.type==='log') {
                    if (old(item.date || key.slice(7))) removals.push(key);
                    continue;
                }
                const next={...item};let changed=false;
                for (const field of ['date','tab0','tab2']) {
                    if (!record(item[field])) continue;
                    const entries=Object.entries(item[field]);
                    const kept=entries.filter(([date]) => !old(date));
                    if (kept.length !== entries.length) {next[field]=Object.fromEntries(kept);snapshots+=entries.length-kept.length;changed=true;}
                }
                if (record(next.date) && !Object.keys(next.date).length) removals.push(key);
                else if (!item.date && old(item.updateTime)) removals.push(key);
                else if (changed) updates[key]=next;
            }
            if (Object.keys(updates).length) await setLocal(updates);
            if (removals.length) await new Promise<void>((resolve,reject) => chrome.storage.local.remove(removals, () => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));else resolve();
            }));
            return {ok:true,records:removals.length,snapshots};
        }).then(reply,error=>reply({ok:false,error:String(error)}));
        return true;
    });
    chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
        if (!record(message) || (message.type !== 'AES_SETTINGS_CAS' && message.type !== 'AES_FLIGHT_PLAN_JOB' && message.type !== 'AES_RECORD_PATCH')) return false;
        if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab?.id || !sender.documentId ||
            !sender.url || !/^https:\/\/[^/]+\.airlinesim\.aero\//.test(sender.url)) {
            reply({ok:false, error:'A top-level AirlineSim page is required.'}); return false;
        }
        enqueue(finish => {
            const respond = (value: unknown) => { try { reply(value); } finally { finish(); } };
            if (message.type === 'AES_RECORD_PATCH') {
                void (async () => {
                    const prefix = new URL(sender.url!).hostname.split('.')[0];
                    const key = message.key;
                    if (typeof key !== 'string' || !key.startsWith(prefix) || !/^(?:\d+(?:_\d+)?competitorMonitoring|\d+competitorMonitoringIndex|\d+aircraftFleet|aircraftFlights\d+|\d+aircraftFlightPlanHub\d+)$/.test(key.slice(prefix.length))) throw new Error('Invalid record scope.');
                    const current = (await getLocal(key))[key];
                    const value = AESStorage.merge(message.before, message.after, current);
                    if (value === undefined) throw new Error('Cannot remove this record.');
                    await setLocal({[key]: value});
                    return {ok:true, value};
                })().then(respond, error => respond({ok:false,error:String(error instanceof Error ? error.message : error)}));
                return;
            }
            if (message.type === 'AES_SETTINGS_CAS') {
                if (!record(message.next)) { respond({ok:false,error:'Invalid settings.'}); return; }
                chrome.storage.local.get('settings', result => {
                    if (chrome.runtime.lastError) { respond({ok:false,error:chrome.runtime.lastError.message}); return; }
                    const current = record(result.settings) ? result.settings : {};
                    if (JSON.stringify(current) !== message.expected) { respond({ok:true,conflict:true}); return; }
                    chrome.storage.local.set({settings:message.next}, () => {
                        respond(chrome.runtime.lastError ? {ok:false,error:chrome.runtime.lastError.message} : {ok:true});
                    });
                });
                return;
            }
            void (async () => {
                const url = new URL(sender.url!);
                const aircraft = url.pathname.match(/^\/app\/fleets\/aircraft\/(\d+)\/0(?:[;/]|$)/)?.[1];
                const prefix = url.hostname.split('.')[0];
                const key = message.key;
                if (!aircraft || typeof key !== 'string' || !key.startsWith(prefix) ||
                    !/^\d+flightPlanSchedulingJob$/.test(key.slice(prefix.length))) throw new Error('Invalid scheduling scope.');
                const ownerKey = 'aesJobOwner:' + key;
                const raw = (await getLocal(key))[key];
                const current = record(raw) ? raw : null;
                const owner = (await chrome.storage.session.get(ownerKey))[ownerKey];
                const active = raw != null && (!current || !['done','error'].includes(String(current.status)));
                if (message.op === 'create' || message.op === 'claim') {
                    if (message.op === 'create' && active) throw new Error('Another scheduling job exists. Open its aircraft to resume or stop it.');
                    if (message.op === 'claim' && current?.targetAircraftId != null && String(current.targetAircraftId) !== aircraft) throw new Error('Open the target aircraft to manage this job.');
                    if (record(owner) && owner.tab !== sender.tab!.id && raw != null) {
                        let live = false;
                        try { await chrome.tabs.get(Number(owner.tab)); live = true; } catch { /* Closed tab: explicit recovery is allowed. */ }
                        if (live) throw new Error('Scheduling is controlled by another tab.');
                    }
                    const token = crypto.randomUUID();
                    if (message.op === 'create') {
                        if (!record(message.job) || String(message.job.targetAircraftId) !== aircraft) throw new Error('Invalid target aircraft.');
                        await setLocal({[key]:{...message.job, _aesJobId:token}});
                    }
                    await chrome.storage.session.set({[ownerKey]:{token, tab:sender.tab!.id, document:sender.documentId,
                        jobId:message.op === 'create' ? token : current?._aesJobId ?? null}});
                    return {ok:true,token};
                }
                if (!record(owner) || owner.token !== message.token || owner.tab !== sender.tab!.id || owner.document !== sender.documentId ||
                    owner.jobId !== (current?._aesJobId ?? null)) throw new Error('Scheduling ownership changed. Reload the target page.');
                if (message.op === 'save') {
                    if (!record(message.job) || String(message.job.targetAircraftId) !== aircraft) throw new Error('Invalid target aircraft.');
                    await setLocal({[key]:{...message.job,_aesJobId:owner.jobId}});
                } else if (message.op === 'clear') {
                    await removeLocal(key);
                    await chrome.storage.session.remove(ownerKey);
                } else if (message.op !== 'check') throw new Error('Unsupported job operation.');
                return {ok:true};
            })().then(respond, error => respond({ok:false,error:error instanceof Error ? error.message : String(error)}));
        });
        return true;
    });
})();
