/** Globals installed by the local browser fixtures or the compiled classic scripts. */
interface Window {
    theme?: string;
    AES: import('../support/fixtures.cts').VMValue;
    AESI18n: import('../support/fixtures.cts').VMValue;
    recordPriceDispatch: (item: {url: string; time: number}) => Promise<void>;
}
declare var saved: {aesReleaseNotesSeenVersion?: string};
declare var recordTabDispatch: (item: {kind: string; url: string; started: number}) => Promise<void>;
declare var inventoryPriceDispatches: {url: string; started: number}[];

declare const AESScheduleDiff: {
    open(raw: unknown, name: string): void;
    compare(before: unknown, after: unknown, current?: () => boolean): Promise<{changes: {flight: string; kind: string}[]}>;
};
declare class ReleaseNotesDialog {constructor(version: string)}

declare var auditPageDispatches: {url?: string; time: number}[];
