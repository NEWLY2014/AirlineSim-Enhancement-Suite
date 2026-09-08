const { cpSync, mkdirSync, readdirSync, rmSync } = require('node:fs');
const { dirname, join, relative, sep } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(__dirname, '..');
const source = join(root, 'extension');
const output = join(root, 'build', 'extension');
rmSync(output, { recursive: true, force: true });
// First-party scripts must pass through TypeScript; only vendored JS is copied.
function validateRuntimeSources(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) validateRuntimeSources(path);
        else if (/\.[cm]?js$/.test(entry.name) && !relative(source, path).startsWith(join('js', 'vendor') + sep)) {
            throw new Error('First-party runtime must be TypeScript: ' + relative(source, path));
        }
    }
}
validateRuntimeSources(source);
const compiler = spawnSync(process.execPath, [join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc'), '-p', join(root, 'tsconfig.json')], { stdio: 'inherit' });
if (compiler.error || compiler.status !== 0) {
    rmSync(output, { recursive: true, force: true });
    if (compiler.error) console.error(compiler.error);
    process.exit(compiler.status || 1);
}
function copyAssets(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || /\.(log|map)$/.test(entry.name)) continue;
        const from = join(directory, entry.name);
        const path = relative(source, from);
        if (entry.isDirectory()) copyAssets(from);
        // Copy static assets and vendored JavaScript; runtime scripts are compiler output.
        else if (!/\.[cm]?ts$/.test(entry.name)) {
            const destination = join(output, path);
            mkdirSync(join(destination, '..'), { recursive: true });
            cpSync(from, destination);
        }
    }
}
copyAssets(source);
