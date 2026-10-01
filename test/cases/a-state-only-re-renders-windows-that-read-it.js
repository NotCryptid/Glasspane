'use strict';
// Each window re-rendering on every unrelated keystroke is the cost this avoids.
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App, state } = require('../../lib/index.js');
const { Text } = require('../../lib/view.js');

const onlyOne = state('a');
const onlyTwo = state('x');
App('One', () => Text('1:' + onlyOne.value));
App('Two', () => Text('2:' + onlyTwo.value));

(async () => {
  await tick(10);
  host.sent.length = 0;

  onlyOne.value = 'b';
  await tick(10);
  const afterOne = host.renders().map((r) => r.window);
  assert.deepStrictEqual(afterOne, [1], 'only window 1 should re-render');

  host.sent.length = 0;
  onlyTwo.value = 'y';
  await tick(10);
  assert.deepStrictEqual(host.renders().map((r) => r.window), [2], 'only window 2 should re-render');

  console.log('independent states re-rendered only their own window');
  done(host);
})();
