/**
 * Values crossing a vm/jsdom boundary have no static module identity. Tests also
 * deliberately seed incomplete and corrupt legacy records. Keep that escape hatch
 * here; callbacks, DOM controls and the harness itself use concrete types.
 */
export type VMValue = any;
export type FixtureData = Record<string, VMValue>;
export type Cleanup = Pick<import('node:test').TestContext, 'after'>;
export type Reply = (value?: VMValue) => void;
export type Listener = (message: VMValue, sender: VMValue, reply: Reply) => boolean | void;
export interface MockStorage {
    get(keys: string | string[] | FixtureData | null, callback?: Reply): VMValue;
    set(values: FixtureData, callback?: Reply): VMValue;
    remove(keys: string | string[], callback?: Reply): VMValue;
    clear(callback?: Reply): VMValue;
    getKeys?(): Promise<string[]>;
    getBytesInUse?(keys: string | string[] | null): Promise<number>;
}
export interface MockRuntime {
    id?: string;
    lastError?: {message?: string} | null;
    getManifest?: () => {version: string; version_name?: string};
    getURL?: (path: string) => string;
    sendMessage?: (message: VMValue, callback: Reply) => void;
    onMessage?: {addListener: (fn: Listener) => void; removeListener?: (fn: Listener) => void};
}
export interface MockChrome {runtime: MockRuntime; storage: {local: MockStorage}}
export interface StorageCall {operation: 'set' | 'remove' | 'clear'; values?: FixtureData; keys?: string | string[]}

export type BrowserPage = ReturnType<import('./browser.cts').API['browser']>;

export interface PlannerState {serverDelay: number; serverDoneDelay: number; serverResponds: boolean; serverFails: boolean; pendingUpdates: number; maxPendingUpdates: number}
export interface QueueReply {ok: boolean; state?: string; error?: string; expires?: number}

/** DOM identity and browser APIs survive execution in jsdom; injected globals do not. */
export interface TestWindow {
    [key: string]: VMValue;
    document: Document;
    location: Location;
    navigator: Navigator;
    chrome: MockChrome;
    console: Console;
    $: JQueryStatic;
    close(): void;
    open: Window['open'];
    fetch: (url: string | URL, options?: VMValue) => Promise<VMValue>;
    setTimeout: (fn: (...args: VMValue[]) => void, ms?: number, ...args: VMValue[]) => number;
    clearTimeout: (id?: number) => void;
    setInterval: (fn: (...args: VMValue[]) => void, ms?: number, ...args: VMValue[]) => number;
    clearInterval: (id?: number) => void;
    HTMLInputElement: typeof HTMLInputElement;
    HTMLSelectElement: typeof HTMLSelectElement;
    HTMLAnchorElement: typeof HTMLAnchorElement;
    HTMLDialogElement: typeof HTMLDialogElement;
    HTMLElement: typeof HTMLElement;
    HTMLFormElement: typeof HTMLFormElement;
    MutationObserver: typeof MutationObserver;
    Event: typeof Event;
    File: typeof File;
    URL: typeof URL;
}
