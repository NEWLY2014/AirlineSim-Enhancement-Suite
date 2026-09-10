/** Merge schedule history off the page's main thread, retaining the existing backup format. */
(() => {
    const queues = new Map<string, Promise<unknown>>();
    const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
    chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
        if (!record(message) || (message.type !== 'AES_SAVE_SCHEDULE' && message.type !== 'AES_SAVE_COMPETITOR')) return false;
        let url: URL;
        try { url = new URL(sender.url || ''); } catch { reply({ok:false, error:'Invalid schedule page.'}); return false; }
        const pageId = url.pathname.match(/^\/app\/info\/enterprises\/(\d+)(?:;[^/]*)?\/?$/)?.[1];
        const id = record(message.airline) ? String(message.airline.id || '') : '';
        const permittedPage = (pageId === id && ['0','2','3'].includes(url.searchParams.get('tab') || '0')) || url.pathname === '/app/enterprise/dashboard';
        const snapshot = message.snapshot;
        const competitor = message.type === 'AES_SAVE_COMPETITOR';
        if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || sender.tab?.id === undefined || !sender.documentId ||
            url.protocol !== 'https:' || !url.hostname.endsWith('.airlinesim.aero') || url.port || !/^\d+$/.test(id) || !permittedPage ||
            !record(message.airline) || String(message.airline.id) !== id ||
            (!competitor && (!record(snapshot) || typeof snapshot.date !== 'string' || !/^\d{8}$/.test(snapshot.date) || typeof snapshot.updateTime !== 'string' ||
            !Array.isArray(snapshot.schedule) || !snapshot.schedule.length)) ||
            (competitor && (!record(message.ownerAirline) || !/^\d+$/.test(String(message.ownerAirline.id)) || !record(message.overview) || !record(message.facts) ||
                !/^\d{8}$/.test(String(message.overview.date)) || !/^\d{8}$/.test(String(message.facts.date))))) {
            reply({ok:false, error:'Invalid schedule save request.'}); return false;
        }
        const server = url.hostname.split('.')[0];
        const owner = record(message.ownerAirline) ? String(message.ownerAirline.id) : '';
        const key = competitor ? server+owner+'_'+id+'competitorMonitoring' : server + id + 'schedule';
        const operation = (queues.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
            const result = await new Promise<Record<string, unknown>>((resolve, reject) => chrome.storage.local.get(competitor ? [key,server+id+'competitorMonitoring'] : key, data => {
                if (chrome.runtime.lastError) reject(new Error('Unable to read schedule history: ' + chrome.runtime.lastError.message));
                else resolve(data);
            }));
            const old = record(result[key]) ? result[key] : {};
            let value: Record<string,unknown>;
            if (competitor) {
                const legacyKey = server+id+'competitorMonitoring';
                const legacy = record(result[legacyKey]) ? result[legacyKey] : {};
                const overview = message.overview as Record<string,unknown>, facts = message.facts as Record<string,unknown>;
                const tab0 = {...(record(legacy.tab0) ? legacy.tab0 : {}), ...(record(old.tab0) ? old.tab0 : {}), [String(overview.date)]:overview};
                const tab2 = {...(record(legacy.tab2) ? legacy.tab2 : {}), ...(record(old.tab2) ? old.tab2 : {})};
                if (!Object.values(tab2).some(value => record(value) && value.week === facts.week)) tab2[String(facts.date)] = facts;
                value = {tracking:0,...legacy,...old,key,server,id,ownerId:owner,ownerAirline:message.ownerAirline,type:'competitorMonitoring',tab0,tab2,autoExtract:0};
            } else {
                const schedule = snapshot as Record<string,unknown>;
                value = {...old, type:'schedule', server, airline:message.airline,
                    date:{...(record(old.date) ? old.date : {}), [String(schedule.date)]:schedule}};
            }
            const acknowledgement = await chrome.tabs.sendMessage(sender.tab!.id!, {type:'AES_SCHEDULE_OWNER_CHECK',token:message.token}, {documentId:sender.documentId});
            if (!record(acknowledgement) || acknowledgement.ok !== true) throw new Error('Schedule page is no longer active.');
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
