'use strict';
// Dependencies are replaced on each render, not merged, so a state that drops out of a window's
// tree stops waking that window.
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App, state } = require('../../lib/index.js');
const { Text } = require('../../lib/view.js');

const gate = state(true);
const extra = state(0);
App('One', () => (gate.value ? Text('on' + extra.value) : Text('off')));

(async () => {
  await tick(10);
  assert.strictEqual(host.last(1).root.p.text, 'on0');

  extra.value = 1;
  await tick(10);
  assert.strictEqual(host.last(1).root.p.text, 'on1', 'a state the tree reads should re-render it');

  // Closing the gate means the window no longer reads `extra`.
  gate.value = false;
  await tick(10);
  assert.strictEqual(host.last(1).root.p.text, 'off');

  host.sent.length = 0;
  extra.value = 2;
  await tick(10);
  assert.strictEqual(host.renders().length, 0, 'a state the tree no longer reads should be inert');

  // gate is still read, so it must still work, and extra is read again.
  gate.value = true;
  await tick(10);
  assert.strictEqual(host.last(1).root.p.text, 'on2');

  console.log('dependency set was replaced, not accumulated');
  done(host);
})();
