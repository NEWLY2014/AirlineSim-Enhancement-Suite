/** Merge schedule history off the page's main thread, retaining the existing backup format. */
(() => {
    const queues = new Map<string, Promise<unknown>>();
    const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
    chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
        if (!record(message) || message.type !== 'AES_SAVE_SCHEDULE') return false;
        let url: URL;
        try { url = new URL(sender.url || ''); } catch { reply({ok:false, error:'Invalid schedule page.'}); return false; }
        const id = url.pathname.match(/^\/app\/info\/enterprises\/(\d+)(?:;[^/]*)?\/?$/)?.[1];
        const snapshot = message.snapshot;
        if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || sender.tab?.id === undefined || !sender.documentId ||
            url.protocol !== 'https:' || !url.hostname.endsWith('.airlinesim.aero') || url.port || !id || url.searchParams.get('tab') !== '3' ||
            !record(message.airline) || String(message.airline.id) !== id ||
            !record(snapshot) || typeof snapshot.date !== 'string' || !/^\d{8}$/.test(snapshot.date) || typeof snapshot.updateTime !== 'string' ||
            !Array.isArray(snapshot.schedule) || !snapshot.schedule.length) {
            reply({ok:false, error:'Invalid schedule save request.'}); return false;
        }
        const server = url.hostname.split('.')[0];
        const key = server + id + 'schedule';
        const operation = (queues.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
            const result = await new Promise<Record<string, unknown>>((resolve, reject) => chrome.storage.local.get(key, data => {
                if (chrome.runtime.lastError) reject(new Error('Unable to read schedule history: ' + chrome.runtime.lastError.message));
                else resolve(data);
            }));
            const old = record(result[key]) ? result[key] : {};
            const value = {...old, type:'schedule', server, airline:message.airline,
                date:{...(record(old.date) ? old.date : {}), [snapshot.date as string]:snapshot}};
            const owner = await chrome.tabs.sendMessage(sender.tab!.id!, {type:'AES_SCHEDULE_OWNER_CHECK'}, {documentId:sender.documentId});
            if (!record(owner) || owner.ok !== true) throw new Error('Schedule page is no longer active.');
            await new Promise<void>((resolve, reject) => chrome.storage.local.set({[key]:value}, () => {
                if (chrome.runtime.lastError) reject(new Error('Unable to save schedule: ' + chrome.runtime.lastError.message));
                else resolve();
            }));
        });
        queues.set(key, operation);
        void operation.then(() => reply({ok:true}), error => reply({ok:false, error:error instanceof Error ? error.message : String(error)}))
            .finally(() => { if (queues.get(key) === operation) queues.delete(key); });
        return true;
    });
})();
