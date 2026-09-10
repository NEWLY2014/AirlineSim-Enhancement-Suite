/** Background-only mutations. Keep read/compare/write in one worker queue. */
(() => {
    const pending: Array<() => void> = [];
    let busy = false;
    const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
    function enqueue(action: (finish: () => void) => void) {
        pending.push(() => action(() => { busy = false; drain(); }));
        drain();
    }
    function drain() {
        if (busy || !pending.length) return;
        busy = true;
        pending.shift()!();
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
        if (!record(message) || (message.type !== 'AES_SETTINGS_CAS' && message.type !== 'AES_FLIGHT_PLAN_JOB')) return false;
        if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab?.id || !sender.documentId ||
            !sender.url || !/^https:\/\/[^/]+\.airlinesim\.aero\//.test(sender.url)) {
            reply({ok:false, error:'A top-level AirlineSim page is required.'}); return false;
        }
        enqueue(finish => {
            const respond = (value: unknown) => { try { reply(value); } finally { finish(); } };
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
