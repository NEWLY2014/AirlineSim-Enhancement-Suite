const { test } = require('node:test') as typeof import('node:test');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } = require('node:fs') as typeof import('node:fs');
const { tmpdir } = require('node:os') as typeof import('node:os');
const { join } = require('node:path') as typeof import('node:path');
const { spawnSync } = require('node:child_process') as typeof import('node:child_process');

test('release validation accepts stable build numbers and historical betas, rejecting mismatched versions', () => {
    const source = mkdtempSync(join(tmpdir(), 'aes-release-'));
    mkdirSync(join(source, 'extension'));
    try {
        for (const [tag, numeric, display, valid] of [
            ['v0.9.0', '0.9.0.17', '0.9.0', true],
            ['v0.8.13', '0.8.13', '0.8.13', true],
            ['v0.9.0-beta.16', '0.9.0.16', '0.9.0-beta.16', true],
            ['v0.9.0-beta', '0.9.0', '0.9.0-beta', true],
            ['v0.9.0', '0.9.1.17', '0.9.0', false],
            ['v0.9.0', '0.9.0.17', '0.9.0-beta.17', false],
            ['v0.9.0-beta.17', '0.9.0.16', '0.9.0-beta.17', false],
            ['v0.9.0', '0.9.0.65536', '0.9.0', false]
        ] as const) {
            writeFileSync(join(source, 'extension/manifest.json'), JSON.stringify({ version: numeric, version_name: display }));
            writeFileSync(join(source, 'package.json'), JSON.stringify({ version: display }));
            const result = spawnSync(process.execPath, [join(__dirname, '../.github/scripts/validate-release-version.cts'), source, tag], { encoding: 'utf8' });
            assert.equal(result.status === 0, valid, tag + ': ' + result.stderr);
            if (valid) {
                assert.ok(result.stdout.includes('display_version=' + display));
                assert.ok(result.stdout.includes('channel=' + (tag.includes('-beta') ? 'beta' : 'stable')));
            }
        }
    } finally { rmSync(source, { recursive: true, force: true }); }
});

test('every Changelog version has a unique linked heading', () => {
    const changelog = readFileSync(join(__dirname, '../CHANGELOG.md'), 'utf8');
    const headings = Array.from(changelog.matchAll(/^## (.+)$/gm), match => match[1]);
    const definitions = Array.from(changelog.matchAll(/^\[([^\]]+)\]: (https:\/\/\S+)$/gm), match => match[1].toLowerCase());
    assert.equal(new Set(definitions).size, definitions.length);
    for (const heading of headings) {
        const match = /^\[([^\]]+)\](?: - \d{4}-\d{2}-\d{2})?$/.exec(heading);
        assert.ok(match, heading);
        assert.ok(definitions.includes(match[1].toLowerCase()), heading);
    }
});
