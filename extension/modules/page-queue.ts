/** Session-persistent FIFO. State changes notify clients; each source claims its
 * own permit. No timer or open response channel must survive worker suspension. */
(() => {
    const KEY = 'aesPageQueueV1';
    const CONCURRENCY = 5;
    const gap = () => 55 + Math.floor(Math.random() * 11);
    const PAGE_TIMEOUT = 120000;
    const COOLDOWN = 60000;
    const LEASE = 10000;
    const CLIENT_TIMEOUT = 120000; // Background-tab polling can be throttled to once a minute.
    const TAB_EDIT_ERROR = 'Tabs cannot be edited right now (user may be dragging a tab).';
    const TAB_EDIT_TIMEOUT = 30000;
    type Kind = 'open' | 'price' | 'navigate' | 'read' | 'salary';
    interface Job {
        id: string; kind: Kind; url: string; source: number; document: string;
        seen: number; state: 'queued' | 'running' | 'done' | 'failed';
        started?: number; expires?: number; target?: number; loading?: boolean;
        tabEditDeadline?: number; tabEditRetries?: number; navigationStarted?: boolean;
        error?: string;
    }
    interface State { jobs: Job[]; next: number; backoff?: number; lastFailure?: number }
    let serial: Promise<unknown> = Promise.resolve();
    const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
    function allowed(url: unknown, kind: Kind): url is string {
        if (typeof url !== 'string') return false;
        try {
            const u = new URL(url);
            if (u.protocol !== 'https:' || !u.hostname.endsWith('.airlinesim.aero') || u.username || u.password || u.port) return false;
            if (kind === 'read') return (u.pathname === '/action/info/flight' && /^\d+$/.test(u.searchParams.get('id') || '') && [...u.searchParams.keys()].every(k => k === 'id')) ||
                (/^\/app\/info\/enterprises\/\d+$/.test(u.pathname) && ['0','2','3'].includes(u.searchParams.get('tab') || '') && [...u.searchParams.keys()].every(k => k === 'tab'));
            if (kind === 'salary') return u.pathname === '/action/enterprise/staffOverview' && !u.search && !u.hash;
            if (kind === 'price') return /^\/app\/com\/inventory\//.test(u.pathname);
            return /^\/app\/com\/inventory\//.test(u.pathname) || /^\/app\/fleets\/aircraft\/[^/]+\/[01]/.test(u.pathname) ||
                /^\/app\/info\/enterprises\//.test(u.pathname) || (u.pathname === '/action/info/flight' && u.searchParams.has('id'));
        } catch { return false; }
    }
    function isJob(x: unknown): x is Job {
        return record(x) && typeof x.id === 'string' && ['open','price','navigate','read','salary'].includes(String(x.kind)) &&
            typeof x.url === 'string' && typeof x.source === 'number' && typeof x.document === 'string' && typeof x.seen === 'number' &&
            ['queued','running','done','failed'].includes(String(x.state)) &&
            (x.started === undefined || typeof x.started === 'number') && (x.expires === undefined || typeof x.expires === 'number') &&
            (x.tabEditDeadline === undefined || typeof x.tabEditDeadline === 'number') &&
            (x.tabEditRetries === undefined || typeof x.tabEditRetries === 'number') &&
            (x.target === undefined || typeof x.target === 'number') && (x.loading === undefined || typeof x.loading === 'boolean') &&
            (x.navigationStarted === undefined || typeof x.navigationStarted === 'boolean');
    }
    async function transaction(change: (s: State) => Promise<unknown>) {
        const result = serial.then(async () => {
            const stored = (await chrome.storage.session.get(KEY))[KEY];
            const state: State = record(stored) && Array.isArray(stored.jobs) && stored.jobs.every(isJob) && typeof stored.next === 'number'
                ? { jobs: stored.jobs, next: stored.next,
                    backoff: typeof stored.backoff === 'number' ? stored.backoff : undefined,
                    lastFailure: typeof stored.lastFailure === 'number' ? stored.lastFailure : undefined } : {jobs: [], next: 0};
            return change(state);
        });
        serial = result.catch(() => {});
        return result;
    }
    const notices = new Map<string,string>();
    function wakeAt(s: State) {
        const active = s.jobs.filter(j => j.state === 'running' || j.loading);
        const head = s.jobs.find(j => j.state === 'queued');
        // A tab must finish its current request/navigation before another
        // operation can use that same document, even when other slots are free.
        const sameTab = head?.kind !== 'open' ? active.filter(j => j.target === head?.source) : [];
        return Math.max(s.next,
            active.length >= CONCURRENCY ? Math.min(...active.map(j => j.expires || 0)) : 0,
            ...sameTab.map(j => j.expires || 0));
    }
    const save = async (s: State) => {
        await chrome.storage.session.set({[KEY]: s});
        const head = s.jobs.find(j => j.state === 'queued');
        for (const job of s.jobs) {
            if (job.state === 'queued' && job !== head) continue;
            const notBefore = job.state === 'queued' ? wakeAt(s) : 0;
            const signature = job.state + ':' + notBefore;
            if (notices.get(job.id) === signature) continue;
            notices.set(job.id, signature);
            void chrome.tabs.sendMessage(job.source, {type:'AES_PAGE_QUEUE_READY',id:job.id,notBefore}, {documentId:job.document}).catch(() => {
                // A suspended or closed document cannot receive a notification.
                // Its bounded recovery check can read the persisted state later.
                notices.delete(job.id);
            });
        }
        for (const id of notices.keys()) if (!s.jobs.some(j => j.id === id)) notices.delete(id);
    };
    function fail(job: Job, error: string) { job.state = 'failed'; job.error = error; }
    async function pump(s: State) {
        const now = Date.now();
        s.jobs = s.jobs.filter(j => j.state === 'queued' || j.state === 'running' || j.loading || now - j.seen < 60000);
        for (const job of s.jobs) {
            if (job.state === 'queued' && now - job.seen > CLIENT_TIMEOUT) fail(job, 'The requesting page stopped waiting.');
        }
        for (const active of s.jobs.filter(j => j.state === 'running' || j.loading)) {
            // Recover missed completion events after worker suspension. Until a
            // navigation has started, the old complete state is not an ack.
            if (active.loading && active.target !== undefined && active.navigationStarted) {
                try {
                    if ((await chrome.tabs.get(active.target)).status === 'complete') {
                        active.loading = false; s.next = Math.max(s.next, now + gap());
                    }
                } catch { active.loading = false; s.next = Math.max(s.next, now + gap()); }
            }
            if (!active.loading && active.state !== 'running') continue;
            if (now < (active.expires || 0)) continue;
            // Unknown outcomes are never replayed. Give slow/abandoned requests
            // a recovery pause rather than immediately overlapping another one.
            active.loading = false;
            fail(active, 'Request dispatch permit expired.');
            s.next = Math.max(s.next, now + COOLDOWN);
        }
        if (Date.now() < wakeAt(s)) return;
        const job = s.jobs.find(j => j.state === 'queued');
        if (!job) return;
        // Request permits are granted only by their source page's poll.
        // Another client must never dispatch a pending request for that page.
        if (job.kind === 'price' || job.kind === 'read' || job.kind === 'salary') return;
        const started = Date.now();
        job.state = 'running'; job.started = started; job.expires = started + PAGE_TIMEOUT; s.next = started + gap();
        job.target = job.kind === 'navigate' ? job.source : undefined;
        // Persist intent before the side effect. Restarting must not replay it.
        await save(s);
        try {
            const tab = job.kind === 'navigate'
                ? await chrome.tabs.update(job.source, {url: job.url})
                : await chrome.tabs.create({url: job.url, active: false});
            job.target = tab?.id;
            if (job.target === undefined) fail(job, 'No tab was created.');
            else { job.state = 'done'; job.loading = true; job.navigationStarted = tab?.status === 'loading'; }
            s.next = Math.max(s.next, Date.now() + gap());
        } catch (e) {
            const error = (e instanceof Error ? e.message : String(e)).replace(/^Error: /, '');
            if (error === TAB_EDIT_ERROR) {
                // Chrome rejects this operation before editing the tab strip. It
                // is safe to retry this exact failure, unlike an unknown outcome.
                job.tabEditDeadline ??= Date.now() + TAB_EDIT_TIMEOUT;
                // A throttled client may wake late. Check Chrome once before
                // timing out so an already-cleared drag does not cause failure.
                if (Date.now() >= job.tabEditDeadline) { fail(job, error); return; }
                job.tabEditRetries = (job.tabEditRetries || 0) + 1;
                job.state = 'queued'; delete job.started; delete job.target;
                s.next = Math.min(job.tabEditDeadline, Date.now() + Math.min(1000, 100 * 2 ** Math.min(job.tabEditRetries - 1, 4)));
                // save() tells the existing client when to poll. No worker timer
                // or open message channel must survive suspension during a drag.
            } else fail(job, error);
        }
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
            if (message.op === 'cooldown') {
                if (!sender.url || !/^https:\/\/[^/]+\.airlinesim\.aero\/(?:app|action)\//.test(sender.url)) return {ok:false,error:'Unsupported queue destination.'};
                s.backoff = s.lastFailure !== undefined && now - s.lastFailure < 600000
                    ? Math.min(900000, (s.backoff || COOLDOWN) * 2) : COOLDOWN;
                s.lastFailure = now;
                const requested = typeof message.delay === 'number' && Number.isFinite(message.delay)
                    ? Math.min(86400000, Math.max(0, message.delay)) : 0;
                s.next = Math.max(s.next, now + Math.max(s.backoff, requested));
                await save(s);
                return {ok:true,notBefore:s.next};
            }
            let job = s.jobs.find(j => j.id === requestId);
            if (job && (job.source !== source || job.document !== doc)) return {ok:false,error:'Queue request owner mismatch.'};
            if (message.op === 'enqueue' && !job) {
                const kind = message.kind;
                if ((kind !== 'open' && kind !== 'price' && kind !== 'navigate' && kind !== 'read' && kind !== 'salary') || !allowed(message.url, kind) ||
                    !sender.url || new URL(sender.url).origin !== new URL(message.url).origin ||
                    ((kind === 'price' || kind === 'salary') && sender.url !== message.url)) return {ok:false,error:'Unsupported queue destination.'};
                if (s.jobs.filter(j => j.state === 'queued').length >= 200) return {ok:false,error:'The page queue is full. Try again later.'};
                job = {id:requestId, kind, url:message.url, source, document:doc, seen:now, state:'queued'};
                s.jobs.push(job);
            }
            if (!job) return {ok:false,error:'Queue request expired. Please retry.'};
            job.seen = now;
            if (message.op === 'complete' && (job.kind === 'price' || job.kind === 'read' || job.kind === 'salary') && job.state === 'running') {
                job.state = 'done';
                if (job.kind === 'price') { job.loading = true; job.expires = now + PAGE_TIMEOUT; }
                s.next = Math.max(s.next, now + gap());
            }
            if (message.op === 'cancel') {
                if (job.state === 'queued' || ((job.kind === 'price' || job.kind === 'read' || job.kind === 'salary') && !job.loading)) {
                    if (job.state === 'running') s.next = Math.max(s.next, now + gap());
                    fail(job, 'Cancelled by the requesting page.');
                }
            }
            await pump(s);
            if (message.op === 'poll' && (job.kind === 'price' || job.kind === 'read' || job.kind === 'salary') && job.state === 'queued' &&
                s.jobs.find(j => j.state === 'queued') === job && Date.now() >= wakeAt(s)) {
                const started = Date.now();
                job.state = 'running'; job.started = started; job.expires = started + (job.kind === 'read' || job.kind === 'salary' ? 30000 : LEASE); job.target = source; s.next = started + gap();
            }
            await save(s);
            return {ok:job.state !== 'failed', state:job.state, expires:job.expires, error:job.error,
                retryAfter:Math.max(5, s.next - Date.now()),
                notBefore: s.jobs.find(j => j.state === 'queued') === job ? wakeAt(s) : undefined,
                position:s.jobs.filter(j => j.state === 'queued').indexOf(job) + 1};
        }).then(reply, error => reply({ok:false,error:'Page queue unavailable: ' + String(error)}));
        return true;
    });
    // Target loads hold their slot through redirects and form navigation.
    chrome.tabs.onUpdated.addListener((id, change) => {
        if (change.status !== 'loading' && change.status !== 'complete') return;
        void transaction(async s => {
            for (const job of s.jobs) {
                if (change.status === 'loading') {
                    if (job.source === id && (job.state === 'queued' || (job.kind === 'read' && job.state === 'running'))) {
                        fail(job, 'The requesting page navigated away.'); s.next = Math.max(s.next, Date.now() + gap());
                    }
                    if (job.source === id && job.kind === 'price' && job.state === 'running') {
                        job.state = 'done'; job.loading = true; job.expires = Date.now() + PAGE_TIMEOUT;
                    }
                    if (job.target === id && job.loading) job.navigationStarted = true;
                } else if (job.target === id && job.loading) {
                    job.loading = false; s.next = Math.max(s.next, Date.now() + gap());
                }
            }
            await save(s);
        }).catch(console.error);
    });
    chrome.tabs.onRemoved.addListener(id => {
        void transaction(async s => {
            for (const job of s.jobs) {
                if (job.target === id && job.loading) {job.loading = false; s.next = Math.max(s.next, Date.now() + gap());}
                if (job.source === id && (job.state === 'queued' || (job.kind === 'read' && job.state === 'running'))) {
                    fail(job, 'Tab closed.'); s.next = Math.max(s.next, Date.now() + gap());
                }
            }
            await save(s);
        }).catch(console.error);
    });
})();
