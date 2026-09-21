/** Serialize one record per message, off the UI thread, retaining Blob parts rather than raw history. */
(() => {
    const scope = globalThis as unknown as {onmessage:(event:MessageEvent)=>void;postMessage:(value:unknown)=>void};
    const parts: BlobPart[] = [];
    let count = 0;
    scope.onmessage = event => {
        try {
            const message = event.data;
            if (message.op === 'record') {
                parts.push(new Blob([(count++ ? ',' : '') + JSON.stringify(message.key) + ':' + JSON.stringify(message.value)]));
                scope.postMessage({ok:true});
            } else if (message.op === 'finish') {
                scope.postMessage({ok:true,blob:new Blob(['{"metadata":',JSON.stringify(message.metadata),',"data":{',...parts,'}}'],{type:'application/json'})});
                parts.length = 0;
            }
        } catch(error) {scope.postMessage({ok:false,error:String(error)});}
    };
})();
