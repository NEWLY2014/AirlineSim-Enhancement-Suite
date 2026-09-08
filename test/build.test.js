const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { Script } = require('node:vm');
const { JSDOM } = require('jsdom');
const root = join(__dirname, '..', 'build', 'extension');
const read = path => readFileSync(join(root, path), 'utf8');

test('built manifest and HTML reference existing assets and classic JavaScript', () => {
    const manifest = JSON.parse(read('manifest.json'));
    const sourceManifest = JSON.parse(readFileSync(join(__dirname, '..', 'extension', 'manifest.json'), 'utf8'));
    assert.deepEqual(manifest, sourceManifest);
    const scripts = [manifest.background.service_worker, 'modules/page-queue.js'];
    const assets = [...Object.values(manifest.icons), manifest.options_page];
    for (const group of manifest.content_scripts) {
        scripts.push(...group.js || []);
        assets.push(...group.css || []);
    }
    for (const html of ['options.html', 'popup.html']) {
        const dom = new JSDOM(read(html));
        scripts.push(...Array.from(dom.window.document.querySelectorAll('script[src]'), el => el.getAttribute('src')));
        assets.push(...Array.from(dom.window.document.querySelectorAll('link[href]'), el => el.getAttribute('href')));
        dom.window.close();
    }
    for (const script of new Set(scripts)) {
        assert.doesNotThrow(() => new Script(read(script), { filename: script }));
        if (!script.startsWith('js/vendor/')) assert.ok(statSync(join(__dirname, '..', 'extension', script.replace(/\.js$/, '.ts'))).isFile(), script);
    }
    for (const asset of assets) assert.ok(statSync(join(root, asset)).isFile(), asset);
    assert.equal(read('js/vendor/jquery-4.0.0.min.js'),
        readFileSync(join(__dirname, '..', 'extension', 'js/vendor/jquery-4.0.0.min.js'), 'utf8'));
});

test('built extension excludes TypeScript sources and development artifacts', () => {
    function visit(directory) {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (entry.isDirectory()) visit(join(directory, entry.name));
            else assert.ok(!/\.(?:ts|map|log)$/.test(entry.name) && !entry.name.startsWith('.'), entry.name);
        }
    }
    visit(root);
});


test('runtime sources are TypeScript and vendor JavaScript is unchanged', () => {
    const source = join(__dirname, '..', 'extension');
    function visit(directory, prefix = '') {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const path = join(prefix, entry.name);
            if (entry.isDirectory()) visit(join(directory, entry.name), path);
            else if (entry.name.endsWith('.js')) {
                assert.ok(path.startsWith(join('js', 'vendor')), path);
                assert.equal(read(path), readFileSync(join(source, path), 'utf8'), path);
            }
        }
    }
    visit(source);
});
