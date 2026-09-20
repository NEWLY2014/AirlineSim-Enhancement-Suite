// Runs in the page world. Observe Wicket's response-processing lifecycle only;
// scheduling actions remain in the isolated content script.
(() => {
    type Attributes = { c?: string };
    type WicketEvents = { subscribe(topic: string, callback: (event: unknown, attrs: Attributes) => void): void };
    let installed = false;
    let sequence = 0;
    const requests = new WeakMap<Attributes, number>();
    const emit = (phase: string, component = '', id = 0) => document.dispatchEvent(
        new CustomEvent('aes-planner-response', {detail: JSON.stringify({phase, component, id})})
    );
    document.addEventListener('aes-planner-observe', () => {
        const events = (window as Window & {Wicket?: {Event?: WicketEvents}}).Wicket?.Event;
        if (!events?.subscribe) return;
        if (!installed) {
            installed = true;
            for (const phase of ['init', 'success', 'failure', 'done']) {
                events.subscribe('/ajax/call/' + phase, (_event, attrs) => {
                    if (!attrs || typeof attrs.c !== 'string') return;
                    if (phase === 'init') requests.set(attrs, ++sequence);
                    const id = requests.get(attrs);
                    if (id) emit(phase, attrs.c, id);
                    if (phase === 'done') requests.delete(attrs);
                });
            }
        }
        emit('ready');
    });
})();
