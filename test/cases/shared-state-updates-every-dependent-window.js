'use strict';
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App, state } = require('../../lib/index.js');
const { Text } = require('../../lib/view.js');

const shared = state(0);
App('One', () => Text('A' + shared.value));
App('Two', () => Text('B' + shared.value));

(async () => {
  await tick(10);
  shared.value = 7;
  await tick(10);
  assert.strictEqual(host.last(1).root.p.text, 'A7', 'window 1 should show the new value');
  assert.strictEqual(host.last(2).root.p.text, 'B7', 'window 2 should show the new value');
  console.log('a shared state updated both windows');
  done(host);
})();
