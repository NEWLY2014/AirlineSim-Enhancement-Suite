const { readFileSync } = require('node:fs') as typeof import('node:fs');
const { join } = require('node:path') as typeof import('node:path');

const [source, tag] = process.argv.slice(2);
if (!source || !tag) throw new Error('Usage: validate-release-version.cts <source-directory> <tag>');
const manifest = JSON.parse(readFileSync(join(source, 'extension/manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
const match = /^v(\d+\.\d+\.\d+)(?:-beta(?:\.([1-9]\d*))?)?$/.exec(tag);
if (!match) throw new Error('Unsupported release tag: ' + tag);
const displayVersion = tag.slice(1);
const base = match[1];
const beta = tag.includes('-beta');
const numericPattern = new RegExp('^' + base.replaceAll('.', '\\.') + '(?:\\.[1-9]\\d*)?$');
const numericMatches = beta
    ? manifest.version === (match[2] ? base + '.' + match[2] : base)
    : numericPattern.test(manifest.version);
if (!numericMatches || !manifest.version.split('.').every((part: string) => Number(part) <= 65535)) {
    throw new Error('Tag and manifest numeric version do not match.');
}
if (pkg.version !== displayVersion || (manifest.version_name && manifest.version_name !== displayVersion)) {
    throw new Error('Package and manifest display versions must match ' + displayVersion);
}
console.log('version=' + manifest.version);
console.log('display_version=' + displayVersion);
console.log('tag=' + tag);
console.log('channel=' + (beta ? 'beta' : 'stable'));
