'use strict';
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App, state } = require('../../lib/index.js');
const { Text, Button } = require('../../lib/view.js');

const one = state(0);
const two = state(0);
App('One', () => Text('A' + one.value));
App('Two', () => Button('go', () => two.update((n) => n + 1)));

(async () => {
  await tick(10);
  host.click(2, 'go');
  await tick(10);
  assert.strictEqual(two.value, 1, "window 2's handler should have run");
  assert.strictEqual(one.value, 0, "window 1's state should be untouched");
  console.log("window 2's click ran only its own handler");
  done(host);
})();
