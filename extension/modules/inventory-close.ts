/** Only the requesting, still-current Inventory document may close its own tab. */
(() => {
    chrome.runtime.onMessage.addListener((message, sender, reply) => {
        if (message?.type !== 'AES_CLOSE_INVENTORY') return false;
        if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.documentId ||
            typeof sender.tab?.id !== 'number' || !sender.url ||
            !/^https:\/\/[^/]+\.airlinesim\.aero\/app\/com\/inventory\//.test(sender.url)) {
            reply({ok:false}); return false;
        }
        const tabId = sender.tab.id;
        void (async () => {
            const stored = await chrome.storage.local.get('settings');
            const settings = stored.settings as {invPricing?: {autoClose?: unknown}} | undefined;
            const autoClose = settings?.invPricing?.autoClose;
            // Match readInventorySettings, including settings imported from older backups.
            if (autoClose !== 1 && autoClose !== true && autoClose !== '1') return reply({ok:false,reason:'disabled'});
            const tab = await chrome.tabs.get(tabId);
            if (tab.url !== sender.url || (tab.pendingUrl && tab.pendingUrl !== sender.url)) return reply({ok:false,reason:'page-changed'});
            const confirmed = await chrome.tabs.sendMessage(tabId,
                {type:'AES_CONFIRM_INVENTORY_CLOSE', token:message.token}, {documentId:sender.documentId});
            if (confirmed?.ok !== true) return reply({ok:false,reason:'page-changed'});
            await chrome.tabs.remove(tabId);
            reply({ok:true});
        })().catch(error => reply({ok:false,error:error instanceof Error ? error.message : String(error)}));
        return true;
    });
})();
