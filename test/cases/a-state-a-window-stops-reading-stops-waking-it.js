'use strict';
// Dependencies are replaced on each render, not merged, so a state that drops out of a window's
// tree stops waking that window.
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App, state } = require('../../lib/index.js');
const { Text } = require('../../lib/view.js');

const counter = state(0);
const showExtra = state(true);
App('One', () => Text('n' + counter.value + (showExtra.value ? '+' : '')));

(async () => {
  await tick(10);
  assert.strictEqual(host.last(1).root.p.text, 'n0+');

  // The window stops reading showExtra, so changing it must not re-render.
  showExtra.value = false;
  await tick(10);
  assert.strictEqual(host.last(1).root.p.text, 'n0-', 'first change should still re-render');

  host.sent.length = 0;
  showExtra.value = true;
  await tick(10);
  assert.strictEqual(host.renders().length, 0, 'a state the tree no longer reads should be inert');

  // counter is still read, so it must still work.
  counter.value = 5;
  await tick(10);
  assert.strictEqual(host.last(1).root.p.text, 'n5');

  console.log('dependency set was replaced, not accumulated');
  done(host);
})();
