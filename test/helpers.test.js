const assert = require('assert');
const AES = require('../extension/helpers.js');

// Test AES.cleanInteger
assert.strictEqual(AES.cleanInteger('2,000 AS$'), 2000);
assert.strictEqual(AES.cleanInteger('-3.500 AS$'), -3500);
assert.strictEqual(AES.cleanInteger('256'), 256);
assert.strictEqual(AES.cleanInteger('invalid'), 0);

// Test AES.formatDateString
assert.strictEqual(AES.formatDateString('20240524'), '2024-05-24');
assert.strictEqual(AES.formatDateString('bad'), 'error: invalid format for AES.formatDateString');

console.log('All tests passed');
