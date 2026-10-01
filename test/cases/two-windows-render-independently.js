'use strict';
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App, state } = require('../../lib/index.js');
const { Text } = require('../../lib/view.js');

const a = state(0);
const b = state('x');
App('One', () => Text('A' + a.value));
App('Two', () => Text('B' + b.value));

(async () => {
  await tick(10);
  const ids = host.renders().map((r) => r.window);
  assert.deepStrictEqual(ids, [1, 2], 'both windows should render once');
  assert.strictEqual(host.last(1).root.p.text, 'A0');
  assert.strictEqual(host.last(2).root.p.text, 'Bx');
  console.log('both windows rendered their own tree');
  done(host);
})();
