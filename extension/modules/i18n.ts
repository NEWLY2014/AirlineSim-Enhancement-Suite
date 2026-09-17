/** Local UI translations. Never translate game data, selectors or stored identifiers. */
declare const AES_I18N_CATALOG: Record<string, Record<string,string>>;
namespace AESI18n {
    export const languages:Record<string,string>={en:'English',de:'Deutsch',es:'español',fr:'français',hu:'magyar',nl:'Nederlands',pl:'polski','zh-TW':'中文（台灣）',ja:'日本語'};
    export function normalize(value:unknown):string | undefined {
        if(typeof value!=='string')return;
        const tag=value.replace(/_/g,'-').toLowerCase();
        if(tag==='zh' || tag.startsWith('zh-'))return 'zh-TW';
        const base=tag.split('-')[0];return Object.hasOwn(languages,base) ? base : undefined;
    }
    export function gameLanguage():string | undefined {
        for(const script of document.scripts){
            const match=(script.textContent || '').match(/(?:window\.)?frontendSettings\s*=\s*(\{[\s\S]*?\})\s*;/);
            if(match)try{const value=JSON.parse(match[1]);const language=normalize(value?.languageSettings?.currentLanguageTag);if(language)return language;}catch{/* Ignore unrelated scripts. */}
        }
        return normalize(document.documentElement.lang);
    }
    let language=gameLanguage() || 'en';
    export let preference='auto';
    let ready=false;
    const waiting:Array<()=>void>=[];
    export function whenReady(callback:()=>void){if(ready)callback();else waiting.push(callback);}
    export function locale(){return language;}
    export function t(source:string,values:Record<string,unknown>={}):string {
        const key=source.trim().replace(/\s+/g,' ');
        if(!key)return source;
        const entry=language!=='en' && typeof AES_I18N_CATALOG!=='undefined' ? AES_I18N_CATALOG[language]?.[key] : undefined;
        const message=entry ? (source.match(/^\s*/)?.[0] || '')+entry+(source.match(/\s*$/)?.[0] || '') : source;
        return message.replace(/\{(\w+)\}/g,(all,name)=>Object.hasOwn(values,name) ? String(values[name] ?? '') : all);
    }
    export function errorMessage(message:string):string {
        const prefixes=['Unable to read schedule history: ', 'Unable to save schedule: ', 'Page queue unavailable: '];
        for(const prefix of prefixes)if(message.startsWith(prefix))return t(prefix+'{0}', {0:t(message.slice(prefix.length))});
        return t(message);
    }
    // Use only on markup authored by AES, never on fetched game HTML or user values.
    export function localize(root:Element | DocumentFragment){
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
        let node:Node | null;
        while((node=walker.nextNode())){
            const parent=node.parentElement;
            if(!parent || parent.closest('script,style,textarea,[translate="no"]'))continue;
            if(parent instanceof HTMLOptionElement && !parent.hasAttribute('value'))parent.value=parent.textContent || '';
            node.textContent=t(node.textContent || '');
        }
        for(const el of root.querySelectorAll('[title],[placeholder],[aria-label]')){
            if(el.closest('[translate="no"]'))continue;
            for(const name of ['title','placeholder','aria-label'])if(el.hasAttribute(name))el.setAttribute(name,t(el.getAttribute(name)!));
        }
    }
    export function html(source:string):string {
        if(language==='en')return source;
        const template=document.createElement('template');template.innerHTML=source;localize(template.content);return template.innerHTML;
    }
    export function selector():HTMLElement {
        const label=document.createElement('label');label.className='aes-language-control';
        const text=document.createElement('span');text.textContent=t('AES language');
        const select=document.createElement('select');select.className='form-control';select.id='aes-language';
        label.htmlFor=select.id;label.append(text,select);
        const options={auto:t('Follow game language'),...languages};
        for(const [value,name] of Object.entries(options)){const option=document.createElement('option');option.value=value;option.textContent=name;option.lang=value==='auto' ? language : value;select.append(option);}
        select.value=preference;
        const status=document.createElement('span');status.setAttribute('role','status');label.append(status);
        select.addEventListener('change',()=>{
            const previous=preference,next=select.value;select.disabled=true;
            chrome.storage.local.set({aesLanguage:next},()=>{
                select.disabled=false;
                if(chrome.runtime.lastError){select.value=previous;status.textContent=t('Unable to save language. Please try again.');return;}
                preference=next;status.textContent=t('Language saved. Reload this page to apply.');
            });
        });
        return label;
    }
    const finish=(stored:Record<string,unknown>={})=>{
        preference=stored.aesLanguage==='auto' ? 'auto' : normalize(stored.aesLanguage) || 'auto';
        const detected=gameLanguage();
        language=preference==='auto' ? detected || normalize(stored.aesGameLanguage) || 'en' : preference;
        if(location.protocol==='chrome-extension:')document.documentElement.lang=language;
        ready=true;waiting.splice(0).forEach(callback=>callback());
        if(location.protocol==='https:' && detected && stored.aesGameLanguage!==detected && /\.airlinesim\.aero$/.test(location.hostname)){
            chrome.storage.local.set({aesGameLanguage:detected},()=>{void chrome.runtime.lastError;});
        }
    };
    if(typeof chrome!=='undefined' && chrome.storage?.local?.get)chrome.storage.local.get(['aesLanguage','aesGameLanguage'],data=>{const failed=chrome.runtime.lastError;finish(failed ? {} : data);});
    else finish();
}
