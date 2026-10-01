'use strict';
// Without namespacing, both windows mint the same handler id for a button at the same tree
// position, and clicking one would fire the other's handler.
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App, state } = require('../../lib/index.js');
const { Button } = require('../../lib/view.js');

const one = state(0);
const two = state(0);
const w1 = App('One', () => Button('go', () => one.update((n) => n + 1)));
const w2 = App('Two', () => Button('go', () => two.update((n) => n + 1)));

(async () => {
  await tick(10);
  const id1 = host.button(1, 'go');
  const id2 = host.button(2, 'go');
  assert.ok(id1 && id2, 'both buttons should expose a handler');
  assert.notStrictEqual(id1, id2, `handler ids collided: ${id1}`);
  assert.ok(id1.startsWith('w1') && id2.startsWith('w2'), `ids not window-scoped: ${id1} ${id2}`);
  assert.ok(w1.id !== w2.id, 'windows should have distinct ids');
  console.log(`ids are distinct: ${id1} vs ${id2}`);
  done(host);
})();
