'use strict';
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App, state } = require('../../lib/index.js');
const { Text } = require('../../lib/view.js');

const n = state(0);
const w1 = App('One', () => Text('A' + n.value));
const w2 = App('Two', () => Text('B' + n.value));

(async () => {
  await tick(10);
  w2.close();
  await tick(10);
  assert.deepStrictEqual(host.of('close').map((m) => m.window), [2], 'close should name the window');

  host.sent.length = 0;
  n.value = 9;
  await tick(10);
  assert.strictEqual(host.renders().length, 1, 'only the open window should re-render');
  assert.strictEqual(host.last(1).root.p.text, 'A9');

  assert.ok(w1.id !== w2.id);
  console.log('closing one window left the other live');
  done(host);
})();
