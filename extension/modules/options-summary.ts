/** Return metadata only; large history records never enter the options page on startup. */
(() => {
    chrome.runtime.onMessage.addListener((message, sender, reply) => {
        if (message?.type !== 'AES_OPTIONS_SUMMARY') return false;
        if (sender.id !== chrome.runtime.id || sender.url !== `chrome-extension://${chrome.runtime.id}/options.html`) {
            reply({ok:false});return false;
        }
        void (async () => {
            const storage = chrome.storage.local as typeof chrome.storage.local & {getKeys?: () => Promise<string[]>};
            const keys = storage.getKeys ? await storage.getKeys() : Object.keys(await storage.get(null));
            const items: Record<string,unknown> = {};
            for (const key of keys) {
                const value = (await storage.get(key))[key];
                if (value === undefined) continue;
                const record: Record<string,unknown> = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
                const bytes = await storage.getBytesInUse(key);
                items[key] = {type:typeof record.type === 'string' ? record.type : undefined,date:typeof record.date === 'string' ? record.date : undefined,summaryBytes:bytes,
                    summaryEntries:Array.isArray(record.entries) ? record.entries.length : 0,
                    ...(key === 'aesRestoreRecoveryV1' && record.previous ? {previous:{}} : {})};
            }
            reply({ok:true,items});
        })().catch(error => reply({ok:false,error:String(error)}));
        return true;
    });
})();
