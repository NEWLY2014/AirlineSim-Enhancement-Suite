/** Audit emitted first-party JS so TypeScript syntax and template literals are parsed, not grepped. */
const {parse}=require('acorn');
const {JSDOM}=require('jsdom');
const {readFileSync,readdirSync}=require('node:fs');
const {join,relative}=require('node:path');
const normalize=text=>text.trim().replace(/\s+/g,' ');
const technicalCalls=new Set(['querySelector','querySelectorAll','getElementById','getElementsByClassName','closest','find','filter','children','parent','parents','nextAll','prevAll','siblings','is','hasClass','addClass','removeClass','toggleClass','on','off','trigger','css','getAttribute','removeAttribute','hasAttribute','addEventListener','removeEventListener','matches','matchMedia']);
const technicalProperties=new Set(['className','class','id','href','src','role','type','rel','tabindex']);
const readable=text=>/[A-Za-z]{3}/.test(text) && (/\s/.test(text.trim()) || /^[A-Z][a-z]+[!:]?$/.test(text.trim()));
const member=node=>node?.type==='MemberExpression' ? node.property.name || node.property.value : node?.name;
function auditSource(source,{file='',catalog,exemptions={}}){
    const findings=[];const ast=parse(source,{ecmaVersion:'latest',locations:true});
    const report=(node,text,kind)=>findings.push({file,line:node.loc.start.line,text,kind});
    const check=(node,text,kind='missing catalog entry')=>{
        const key=normalize(text);if(!readable(key))return;
        if(!Object.hasOwn(catalog,key) && !Object.hasOwn(exemptions,key))report(node,key,kind);
    };
    const markup=(node,html,localized)=>{
        const checkText=text=>{
            check(node,text);
            if(!localized && readable(normalize(text)) && !Object.hasOwn(exemptions,normalize(text)))report(node,normalize(text),'untranslated markup text');
        };
        const root=JSDOM.fragment(html),walker=root.ownerDocument.createTreeWalker(root,4);let text;
        while((text=walker.nextNode()))if(!text.parentElement?.closest('script,style,[translate="no"]'))checkText(text.textContent);
        for(const el of root.querySelectorAll('[title],[placeholder],[aria-label],[alt]'))for(const name of ['title','placeholder','aria-label','alt'])if(el.hasAttribute(name))checkText(el.getAttribute(name));
    };
    function visit(node,parent,localized=false){
        if(!node || typeof node!=='object')return;
        if(node.type==='ExpressionStatement' && node.directive)return;
        if(node.type==='CallExpression' && (node.callee.object?.name==='console' || node.arguments[0]?.name==='AES_RELEASE_NOTES'))return;
        if(node.type==='AssignmentExpression' && technicalProperties.has(member(node.left)))return;
        if(node.type==='PropertyDefinition' && technicalProperties.has(node.key.name))return;
        if(node.type==='VariableDeclarator' && ['AES_I18N_CATALOG','AES_RELEASE_NOTES'].includes(node.id?.name))return;
        // The language implementation contains native language names and protocol constants.
        if(node.type==='CallExpression' && node.callee.type==='FunctionExpression' && node.callee.params[0]?.name==='AESI18n')return;
        if(node.type==='CallExpression' && node.callee.object?.name==='AESI18n' && member(node.callee)==='t'){
            if(node.arguments[0]?.type==='Literal' && typeof node.arguments[0].value==='string'){
                const key=normalize(node.arguments[0].value);
                if(!Object.hasOwn(catalog,key))report(node,key,'translation key absent');
            }
            for(const arg of node.arguments.slice(1))visit(arg,node);return;
        }
        if(node.type==='Literal' && typeof node.value==='string'){
            const value=node.value;
            if(/<[a-z]/i.test(value)){if(value.includes('>'))markup(node,value,localized);return;}
            if(parent?.type==='CallExpression'){
                const call=member(parent.callee),index=parent.arguments.indexOf(node);
                if(parent.callee.name==='$' || technicalCalls.has(call))return;
                if(['attr','setAttribute'].includes(call) && (index===0 || !['title','placeholder','aria-label','alt'].includes(parent.arguments[0]?.value)))return;
                if(['text','createTextNode','alert','confirm'].includes(call) && index===0 && readable(value) && !Object.hasOwn(exemptions,normalize(value)))report(node,value,'untranslated literal at UI sink');
            }
            if(parent?.type==='Property' && technicalProperties.has(parent.key.name || parent.key.value))return;
            if(parent?.type==='AssignmentExpression' && technicalProperties.has(member(parent.left)))return;
            if(parent?.type==='AssignmentExpression' && ['textContent','innerText'].includes(member(parent.left)) && readable(value) && !Object.hasOwn(exemptions,normalize(value)))report(node,value,'untranslated literal at UI sink');
            check(node,value);
        }
        if(node.type==='TemplateLiteral'){
            const value=node.quasis.map((q,i)=>(q.value.cooked || '')+(i<node.expressions.length?'{'+i+'}':'')).join('');
            if(/<[a-z][^>]*>/i.test(value))markup(node,value,localized);else check(node,value);
        }
        const childLocalized=localized || (node.type==='CallExpression' && node.callee.object?.name==='AESI18n' && member(node.callee)==='html');
        for(const [key,value] of Object.entries(node)){
            if(['loc','start','end','raw','quasis'].includes(key))continue;
            if(Array.isArray(value))value.forEach(child=>visit(child,node,childLocalized));
            else if(value && typeof value==='object')visit(value,node,childLocalized);
        }
    }
    visit(ast);return findings;
}
function auditProject(){
    const catalog=JSON.parse(readFileSync('extension/locales/en.json','utf8'));
    const exemptions=JSON.parse(readFileSync('scripts/i18n-exemptions.json','utf8'));
    const findings=[];
    function scan(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){
        const file=join(dir,entry.name);if(entry.isDirectory()){if(entry.name!=='vendor')scan(file);}
        else if(file.endsWith('.js')&&!['i18n.js','i18n-data.js'].includes(entry.name))findings.push(...auditSource(readFileSync(file,'utf8'),{file:relative('build/extension',file),catalog,exemptions}));
    }}scan('build/extension');
    for(const file of ['options.html','popup.html'])findings.push(...auditSource('AESI18n.html('+JSON.stringify(readFileSync(join('extension',file),'utf8'))+')',{file,catalog,exemptions}));
    return findings;
}
if(require.main===module){const findings=auditProject();for(const item of findings)console.error(`${item.file}:${item.line}: ${item.kind}: ${JSON.stringify(item.text)}`);console.log(`${findings.length} localization coverage findings`);process.exitCode=findings.length?1:0;}
module.exports={auditSource,auditProject};
