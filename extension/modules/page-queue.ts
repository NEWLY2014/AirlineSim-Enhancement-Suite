/** Shared, session-persistent FIFO for page requests. Polling clients drive it;
 * no timer or open response channel has to survive service-worker suspension. */
(() => {
    const KEY = 'aesPageQueueV1';
    const gap = () => 30 + Math.floor(Math.random() * 41);
    const LEASE = 10000;
    const CLIENT_TIMEOUT = 120000; // Background-tab polling can be throttled to once a minute.
    type Kind = 'open' | 'price' | 'navigate';
    interface Job {
        id: string; kind: Kind; url: string; source: number; document: string;
        seen: number; state: 'queued' | 'running' | 'done' | 'failed';
        started?: number; expires?: number; target?: number; loading?: boolean;
        error?: string;
    }
    interface State { jobs: Job[]; next: number }
    let serial: Promise<unknown> = Promise.resolve();
    const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
    function allowed(url: unknown, kind: Kind): url is string {
        if (typeof url !== 'string') return false;
        try {
            const u = new URL(url);
            if (u.protocol !== 'https:' || !u.hostname.endsWith('.airlinesim.aero') || u.username || u.password || u.port) return false;
            if (kind === 'price') return /^\/app\/com\/inventory\//.test(u.pathname);
            return /^\/app\/com\/inventory\//.test(u.pathname) || /^\/app\/fleets\/aircraft\/[^/]+\/[01]/.test(u.pathname) ||
                /^\/app\/info\/enterprises\//.test(u.pathname) || (u.pathname === '/action/info/flight' && u.searchParams.has('id'));
        } catch { return false; }
    }
    function isJob(x: unknown): x is Job {
        return record(x) && typeof x.id === 'string' && ['open','price','navigate'].includes(String(x.kind)) &&
            typeof x.url === 'string' && typeof x.source === 'number' && typeof x.document === 'string' && typeof x.seen === 'number' &&
            ['queued','running','done','failed'].includes(String(x.state)) &&
            (x.started === undefined || typeof x.started === 'number') && (x.expires === undefined || typeof x.expires === 'number') &&
            (x.target === undefined || typeof x.target === 'number') && (x.loading === undefined || typeof x.loading === 'boolean');
    }
    async function transaction(change: (s: State) => Promise<unknown>) {
        const result = serial.then(async () => {
            const stored = (await chrome.storage.session.get(KEY))[KEY];
            const state: State = record(stored) && Array.isArray(stored.jobs) && stored.jobs.every(isJob) && typeof stored.next === 'number'
                ? { jobs: stored.jobs, next: stored.next } : {jobs: [], next: 0};
            return change(state);
        });
        serial = result.catch(() => {});
        return result;
    }
    const save = (s: State) => chrome.storage.session.set({[KEY]: s});
    function fail(job: Job, error: string) { job.state = 'failed'; job.error = error; }
    async function pump(s: State) {
        const now = Date.now();
        s.jobs = s.jobs.filter(j => j.state === 'queued' || now - j.seen < 60000);
        for (const job of s.jobs) {
            if (job.state === 'queued' && now - job.seen > CLIENT_TIMEOUT) fail(job, 'The requesting page stopped waiting.');
        }
        const submitting = s.jobs.find(j => j.kind === 'price' && j.state === 'running');
        if (submitting) {
            if (now < (submitting.expires || 0)) return;
            fail(submitting, 'Price dispatch permit expired.');
            s.next = Math.max(s.next, now + gap());
        }
        if (now < s.next) return;
        const job = s.jobs.find(j => j.state === 'queued');
        if (!job) return;
        // Price permits are granted only by that page's own poll below. A delayed
        // response must never cause another client to start the pending price job.
        if (job.kind === 'price') return;
        job.state = 'running'; job.started = now; s.next = now + gap();
        job.target = job.kind === 'navigate' ? job.source : undefined;
        // Persist intent before the side effect. Restarting must not replay it.
        await save(s);
        try {
            const tab = job.kind === 'navigate'
                ? await chrome.tabs.update(job.source, {url: job.url})
                : await chrome.tabs.create({url: job.url, active: false});
            job.target = tab?.id;
            if (job.target === undefined) fail(job, 'No tab was created.');
            else job.state = 'done';
            s.next = Math.max(s.next, Date.now() + gap());
        } catch (e) { fail(job, e instanceof Error ? e.message : String(e)); }
    }
    chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
        if (!record(message) || message.type !== 'AES_PAGE_QUEUE') return false;
        const source = sender.tab?.id;
        const doc = sender.documentId;
        if (source === undefined || !doc || sender.frameId !== 0 || sender.id !== chrome.runtime.id || typeof message.id !== 'string' || message.id.length > 100) {
            reply({ok:false,error:'A top-level extension page request is required.'}); return false;
        }
        const requestId = message.id;
        transaction(async s => {
            const now = Date.now();
            let job = s.jobs.find(j => j.id === requestId);
            if (job && (job.source !== source || job.document !== doc)) return {ok:false,error:'Queue request owner mismatch.'};
            if (message.op === 'enqueue' && !job) {
                const kind = message.kind;
                if ((kind !== 'open' && kind !== 'price' && kind !== 'navigate') || !allowed(message.url, kind) ||
                    !sender.url || new URL(sender.url).origin !== new URL(message.url).origin ||
                    (kind === 'price' && sender.url !== message.url)) return {ok:false,error:'Unsupported queue destination.'};
                if (s.jobs.filter(j => j.state === 'queued').length >= 200) return {ok:false,error:'The page queue is full. Try again later.'};
                job = {id:requestId, kind, url:message.url, source, document:doc, seen:now, state:'queued'};
                s.jobs.push(job);
            }
            if (!job) return {ok:false,error:'Queue request expired. Please retry.'};
            job.seen = now;
            if (message.op === 'complete' && job.kind === 'price' && job.state === 'running') {
                job.state = 'done'; s.next = Math.max(s.next, now + gap());
            }
            if (message.op === 'cancel') {
                if (job.state === 'queued' || (job.kind === 'price' && !job.loading)) fail(job, 'Cancelled by the requesting page.');
            }
            await pump(s);
            if (message.op === 'poll' && job.kind === 'price' && job.state === 'queued' &&
                !s.jobs.some(j => j.kind === 'price' && j.state === 'running') && s.jobs.find(j => j.state === 'queued') === job && now >= s.next) {
                job.state = 'running'; job.started = now; job.expires = now + LEASE; job.target = source; s.next = now + gap();
            }
            await save(s);
            return {ok:job.state !== 'failed', state:job.state, expires:job.expires, error:job.error,
                retryAfter:Math.max(5, s.next - Date.now()),
                position:s.jobs.filter(j => j.state === 'queued').indexOf(job) + 1};
        }).then(reply, error => reply({ok:false,error:'Page queue unavailable: ' + String(error)}));
        return true;
    });
    // Navigation only cancels waiting source requests; target load completion
    // never holds or advances the dispatch clock.
    chrome.tabs.onUpdated.addListener((id, change) => {
        if (change.status !== 'loading') return;
        void transaction(async s => {
            for (const job of s.jobs) {
                if (job.source === id && job.state === 'queued') fail(job, 'The requesting page navigated away.');
                // A navigation start is also a dispatch acknowledgement if the
                // submitting document unloads before its explicit reply arrives.
                if (job.source === id && job.kind === 'price' && job.state === 'running') {job.state = 'done'; s.next = Math.max(s.next, Date.now() + gap());}
            }
            await save(s);
        }).catch(console.error);
    });
    chrome.tabs.onRemoved.addListener(id => {
        void transaction(async s => {
            for (const job of s.jobs) if (job.source === id && job.state === 'queued') fail(job, 'Tab closed.');
            await save(s);
        }).catch(console.error);
    });
})();
