const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser, until, source } = require('./support/browser.cjs');

async function options(t, data) {
    const p = browser(t, { html: source('options.html'), helpers: false, data });
    const downloads = [];
    p.w.Blob = Blob;
    p.w.URL.createObjectURL = blob => { downloads.push(blob); return 'blob:aes-test'; };
    p.w.URL.revokeObjectURL = () => {};
    p.w.HTMLAnchorElement.prototype.click = function() {};
    p.load('options.js');
    await until(() => p.w.document.querySelector('#aes-log-file-select').options.length > 0);
    return { ...p, downloads };
}
function selectBackup(p, text, mode) {
    const input = p.w.document.querySelector('#aes-restore-file');
    Object.defineProperty(input, 'files', { configurable: true, value: [new p.w.File([text], 'backup.json', { type: 'application/json' })] });
    p.w.document.querySelector('#aes-restore-mode').value = mode;
    p.run('restoreData()');
}

test('backup filters preserve complete records and metadata without changing storage', async t => {
    const data = { settings: { custom: false }, s: { type: 'schedule', date: { '20260908': {} } },
        p: { type: 'pricing', unknownField: [1, 2] }, xflightInfo42: { money: {} },
        aesLog_20260908: { type: 'log', entries: [{ message: 'hello' }] } };
    const p = await options(t, data);
    for (const [type, keys] of [['all', Object.keys(data)], ['settings', ['settings']], ['schedule', ['s']],
        ['pricing', ['p']], ['flightInfo', ['xflightInfo42']], ['logs', ['aesLog_20260908']]]) {
        p.w.document.querySelector('#aes-backup-type').value = type;
        p.w.document.querySelector('#aes-backup-btn').click();
        const backup = JSON.parse(await p.downloads.at(-1).text());
        assert.equal(backup.metadata.type, type);
        assert.equal(backup.metadata.version, '0.8.13');
        assert.equal(backup.metadata.itemCount, keys.length);
        assert.deepEqual(backup.data, Object.fromEntries(keys.map(key => [key, data[key]])));
    }
    assert.deepEqual(p.saved, data);
});

test('restore merge retains unrelated keys; replace clears before writing', async t => {
    const p = await options(t, { keep: { original: true }, settings: { old: true } });
    const backup = { metadata: { itemCount: 1 }, data: { settings: { custom: false } } };
    selectBackup(p, JSON.stringify(backup), 'merge');
    await until(() => p.calls.length === 1);
    assert.deepEqual(p.saved, { keep: { original: true }, ...backup.data });
    assert.deepEqual(p.calls.map(c => c.operation), ['set']);
    p.calls.length = 0;
    selectBackup(p, JSON.stringify(backup), 'replace');
    await until(() => p.calls.length === 2);
    assert.deepEqual(p.calls.map(c => c.operation), ['clear', 'set']);
    assert.deepEqual(p.saved, backup.data);
});

test('invalid JSON and missing envelope never change stored data', async t => {
    const p = await options(t, { keep: 42 });
    for (const text of ['{broken', '{}']) {
        selectBackup(p, text, 'replace');
        await until(() => p.w.document.querySelector('#aes-status-message').classList.contains('status-error'));
        assert.deepEqual(p.saved, { keep: 42 });
        assert.equal(p.calls.length, 0);
    }
});

test('log listing, individual export and log-only clearing preserve other records', async t => {
    const p = await options(t, { settings: { keep: true }, aesLog_20260907: { date: '20260907', entries: [{ message: 'old' }] },
        aesLog_20260908: { type: 'log', date: '20260908', entries: [{ message: 'new' }, {}] } });
    const select = p.w.document.querySelector('#aes-log-file-select');
    assert.deepEqual(Array.from(select.options, o => o.value), ['aesLog_20260908', 'aesLog_20260907']);
    p.w.document.querySelector('#aes-download-log-btn').click();
    const download = JSON.parse(await p.downloads[0].text());
    assert.deepEqual(Object.keys(download.data), ['aesLog_20260908']);
    assert.equal(download.metadata.date, '20260908');
    p.run('clearLogData()');
    assert.deepEqual(p.saved, { settings: { keep: true } });
    assert.equal(p.w.document.querySelector('#aes-download-log-btn').disabled, true);
});

test('old-data cleanup preserves settings, recent dates and unrecognized date keys', async t => {
    const today = new Date().toISOString();
    const p = await options(t, { settings: { date: { '20000101': {} } }, old: { type: 'schedule', date: { '20000101': {} } },
        mixed: { date: { '20000101': {}, [today]: {} } }, unknown: { date: { 'not-a-date': {} } },
        aesLog_20000101: { type: 'log', date: '20000101' }, recent: { updateTime: today } });
    p.run('clearOldData()');
    assert.deepEqual(Object.keys(p.saved).sort(), ['mixed', 'recent', 'settings', 'unknown']);
});

test('malformed backup envelopes are rejected before replacement can clear data', async t => {
    const p = await options(t, { keep: 42 });
    for (const value of [null, [], { metadata: {}, data: [] }, { metadata: [], data: {} },
        { metadata: {}, data: 'broken' }, { metadata: true, data: { settings: {} } }]) {
        selectBackup(p, JSON.stringify(value), 'replace');
        await until(() => p.w.document.querySelector('#aes-status-message').classList.contains('status-error'));
        assert.deepEqual(p.saved, { keep: 42 });
        assert.equal(p.calls.length, 0);
    }
});

test('restore and backup show storage errors and stop dependent operations', async t => {
    const p = await options(t, { keep: 42 });
    const backup = JSON.stringify({ metadata: {}, data: { replacement: true } });
    p.failures.clear = 'Clear failed';
    selectBackup(p, backup, 'replace');
    await until(() => p.w.document.querySelector('#aes-status-message').textContent.includes('Clear failed'));
    assert.deepEqual(p.calls.map(c => c.operation), ['clear']);
    assert.deepEqual(p.saved, { keep: 42 });
    delete p.failures.clear;
    p.failures.set = 'Write failed';
    selectBackup(p, backup, 'merge');
    await until(() => p.w.document.querySelector('#aes-status-message').textContent.includes('Write failed'));
    assert.deepEqual(p.saved, { keep: 42 });
    p.failures.get = 'Read failed';
    p.run('createBackup()');
    assert.equal(p.downloads.length, 0);
    assert.match(p.w.document.querySelector('#aes-status-message').textContent, /Read failed/);
});

test('unreadable files report errors without changing storage', async t => {
    const p = await options(t, { keep: 42 });
    p.w.FileReader = class {
        error = { message: 'Unreadable file' };
        readAsText() { this.onerror(); }
    };
    selectBackup(p, '', 'replace');
    assert.match(p.w.document.querySelector('#aes-status-message').textContent, /Unreadable file/);
    assert.equal(p.calls.length, 0);
});

test('malformed stored entries can be listed and unknown date layouts are retained', async t => {
    const p = await options(t, { settings: {}, aesLog_20260908: null, unknown: { date: true, updateTime: '2000-01-01' },
        unexpected: { date: ['20260908'] }, primitive: 42 });
    assert.equal(p.w.document.querySelector('#aes-log-file-select').options.length, 1);
    p.run('clearOldData()');
    assert.ok('unknown' in p.saved);
    assert.ok('unexpected' in p.saved);
    assert.ok('primitive' in p.saved);
});

test('error status cancels a pending success-message timer', async t => {
    const p = await options(t, {});
    const timers = new Map();
    let id = 0;
    p.w.setTimeout = (fn, delay) => { timers.set(++id, { fn, delay }); return id; };
    p.w.clearTimeout = timer => timers.delete(timer);
    p.run('showStatusMessage("Done", "success")');
    assert.equal(timers.size, 1);
    p.run('showStatusMessage("Failed", "error")');
    assert.equal(timers.size, 0);
    assert.match(p.w.document.querySelector('#aes-status-message').className, /status-error/);
});
