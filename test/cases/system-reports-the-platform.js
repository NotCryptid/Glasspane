'use strict';
const assert = require('node:assert');
const { createHost, done } = require('../harness');

const host = createHost();
const { system } = require('../../lib/index.js');

assert.strictEqual(system.platform, process.platform === 'darwin' ? 'macos' : 'windows');
console.log('platform reported');
done(host);
