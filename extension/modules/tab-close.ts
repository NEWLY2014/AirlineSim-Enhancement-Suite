/** Only the requesting, still-current document may close its own tab after a confirmed save. */
(() => {
    chrome.runtime.onMessage.addListener((message, sender, reply) => {
        if (message?.type !== 'AES_CLOSE_TAB') return false;
        const inventory = message.kind === 'inventory';
        const flight = message.kind === 'flightInfo';
        let url: URL;
        try {url=new URL(sender.url || '');} catch {reply({ok:false,reason:'page-changed'});return false;}
        const allowedPage = inventory ? /^\/app\/com\/inventory\//.test(url.pathname) :
            flight && url.pathname === '/action/info/flight' && /^\d+$/.test(url.searchParams.get('id') || '');
        if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.documentId ||
            typeof sender.tab?.id !== 'number' || url.protocol !== 'https:' || !url.hostname.endsWith('.airlinesim.aero') ||
            url.port || !allowedPage) {
            reply({ok:false}); return false;
        }
        const tabId = sender.tab.id;
        void (async () => {
            const stored = await chrome.storage.local.get('settings');
            const settings = stored.settings as Record<string,{autoClose?:unknown}> | undefined;
            const autoClose = settings?.[inventory ? 'invPricing' : 'flightInfo']?.autoClose;
            // Match readInventorySettings, including settings imported from older backups.
            if (autoClose !== 1 && autoClose !== true && autoClose !== '1') return reply({ok:false,reason:'disabled'});
            const tab = await chrome.tabs.get(tabId);
            if (tab.url !== sender.url || (tab.pendingUrl && tab.pendingUrl !== sender.url)) return reply({ok:false,reason:'page-changed'});
            const confirmed = await chrome.tabs.sendMessage(tabId,
                {type:'AES_CONFIRM_TAB_CLOSE', token:message.token}, {documentId:sender.documentId});
            if (confirmed?.ok !== true) return reply({ok:false,reason:'page-changed'});
            const latest = await chrome.tabs.get(tabId);
            if (latest.url !== sender.url || (latest.pendingUrl && latest.pendingUrl !== sender.url)) return reply({ok:false,reason:'page-changed'});
            await chrome.tabs.remove(tabId);
            reply({ok:true});
        })().catch(error => reply({ok:false,error:error instanceof Error ? error.message : String(error)}));
        return true;
    });
})();
