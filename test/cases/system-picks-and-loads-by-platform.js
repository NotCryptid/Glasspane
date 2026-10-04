'use strict';
const assert = require('node:assert');
const path = require('node:path');
const { createHost, done } = require('../harness');

const host = createHost();
const { system } = require('../../lib/index.js');

const expected = process.platform === 'darwin' ? 'macos' : 'windows';
assert.strictEqual(system.platform, expected);
assert.strictEqual(system.pick({ windows: 'w', macos: 'm' }), expected === 'macos' ? 'm' : 'w');
assert.strictEqual(system.pick({ default: 'd' }), 'd');
assert.strictEqual(system.pick({}), undefined);

// load() resolves from the main script's folder.
process.argv[1] = path.join(__dirname, '..', '..', 'examples', 'platform.js');
const shell = system.load('./platform/shell');
assert.strictEqual(shell.revealLabel, expected === 'macos' ? 'Reveal in Finder' : 'Show in Explorer');
assert.throws(() => system.load('./platform/missing'), /No missing/);
console.log('platform picks and loads');
done(host);
