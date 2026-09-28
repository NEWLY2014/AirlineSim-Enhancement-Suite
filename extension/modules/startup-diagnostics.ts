declare const AES_STARTUP_CATALOG: Record<string,Record<string,string>>;
/** Independent startup UI: must run before jQuery, translations and helpers. */
namespace AESStartup {
    const messages = {
        shared:'AES could not start: shared components are unavailable. Reload the page; if this continues, copy the diagnostics for support.',
        updated:'AES was updated or disconnected. Reload this page to reconnect.',
        storage:'AES could not access saved data. Reload the page and try again.',
        target:'AES could not find the page area required by this feature.',
        init:'An AES feature could not start. Copy the diagnostics for support.'
    };
    type Kind = keyof typeof messages;
    // Bundled separately so a parse failure in helpers cannot disable this UI.

    let shown = false;
    let version = 'unknown';
    let prefix = '';
    try { const m=chrome.runtime.getManifest();version=m.version_name || m.version;prefix=chrome.runtime.getURL(''); } catch { /* Keep diagnostics usable after invalidation. */ }
    function language() {
        try { if(typeof AESI18n !== 'undefined')return AESI18n.locale(); } catch { /* Independent fallback. */ }
        const tag=(document.documentElement.lang || 'en').toLowerCase();
        return tag.startsWith('zh')?'zh-TW':tag.split('-')[0];
    }
    function translate(text:string) {return AES_STARTUP_CATALOG[language()]?.[text] || text;}
    function available() {try{return typeof AES !== 'undefined';}catch{return false;}}
    function storageAvailable() {try{return !!chrome.storage?.local;}catch{return false;}}
    function sanitize(text:string) {
        return text.replace(/https?:\/\/[^\s"'<>]+/g,raw=>{
            try{const url=new URL(raw);return url.origin+url.pathname;}catch{return '[URL]';}
        }).slice(0,1500);
    }
    export function classify(error:unknown):Kind | undefined {
        const text=error instanceof Error?error.message:String(error);
        if(/extension context invalidated/i.test(text))return 'updated';
        if(/(?:AES|AESI18n|\$|jQuery) is not defined|Cannot access '(?:AES|AESI18n)' before initialization/.test(text))return 'shared';
        if(/chrome\.storage\.local is unavailable/i.test(text))return 'storage';
        if(/insertion target .*not found|Current airline header did not finish loading/i.test(text))return 'target';
    }
    export function report(module:string,error:unknown,kind:Kind='init') {
        if(shown)return;
        shown=true;
        const details=JSON.stringify({version,browser:navigator.userAgent,page:location.origin+location.pathname,
            module:sanitize(module),code:'AES_STARTUP_'+kind.toUpperCase(),
            error:sanitize(error instanceof Error?error.message:String(error)),
            sharedComponentsAvailable:available(),storageInterfaceAvailable:storageAvailable()},null,2);
        const render=()=>{
            if(document.getElementById('aes-startup-error'))return;
            const root=document.createElement('section');root.id='aes-startup-error';root.lang=language();root.setAttribute('role','alert');
            root.style.cssText='padding:12px;margin:8px;border:1px solid #a94442;background:#f2dede;color:#702b29;font:14px/1.5 system-ui;overflow-wrap:anywhere;';
            const message=document.createElement('div');message.textContent=translate(messages[kind]);root.append(message);
            const button=(label:string,action:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=translate(label);b.style.cssText='margin:8px 8px 0 0;font:inherit;';b.addEventListener('click',action);root.append(b);return b;};
            button('Reload page',()=>location.reload());
            button('Copy diagnostics',()=>{void (async()=>{
                try{await navigator.clipboard.writeText(details);status.textContent=translate('Diagnostics copied.');}
                catch{
                    status.textContent=translate('Copy the diagnostics below.');
                    if(root.querySelector('textarea'))return;
                    const field=document.createElement('textarea');field.readOnly=true;field.value=details;
                    field.setAttribute('aria-label',translate('Copy diagnostics'));field.style.cssText='display:block;width:100%;height:160px;box-sizing:border-box;';root.append(field);field.focus();field.select();
                }
            })();});
            button('Dismiss',()=>root.remove());
            const status=document.createElement('span');status.setAttribute('role','status');root.append(status);
            (document.body || document.documentElement).prepend(root);
        };
        if(document.body)render();else document.addEventListener('DOMContentLoaded',render,{once:true});
    }
    export function check() {
        if(!available())report('helpers',new Error('AES is not defined'),'shared');
        else if(!storageAvailable())report('storage',new Error('chrome.storage.local is unavailable'),'storage');
    }
    window.addEventListener('error',event=>{
        if(!prefix || !event.filename.startsWith(prefix))return;
        const file=event.filename.slice(prefix.length);
        const shared=file==='helpers.js' || file.startsWith('js/vendor/jquery-');
        report(file,event.error || event.message,shared?'shared':classify(event.error || event.message) || 'init');
    });
    window.addEventListener('unhandledrejection',event=>{
        const error=event.reason;
        if(!prefix || !(error instanceof Error) || !error.stack?.includes(prefix))return;
        report('runtime',error,classify(error) || 'init');
    });
}
