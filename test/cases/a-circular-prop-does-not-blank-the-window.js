'use strict';
// A circular prop throws inside JSON.stringify, which sits outside the body() guard. This is the
// path that used to blank the window.
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App } = require('../../lib/index.js');
const { Text } = require('../../lib/view.js');

let boom = false;
const circ = {};
circ.self = circ;
App('One', () => (boom ? Text('x').prop('meta', circ) : Text('fine')));

(async () => {
  await tick(10);
  assert.strictEqual(host.last(1).root.p.text, 'fine');

  boom = true;
  host.fromHost({ type: 'event', window: 1, id: 'anything', seq: 1 });
  await tick(10);

  const root = host.last(1).root;
  assert.strictEqual(root.t, 'VStack', 'the window should not be blank');
  const detail = root.c[1].c[0].p.text;
  assert.match(detail, /circular/i, 'should report the circular structure');
  console.log('circular prop fell back to the error view');
  done(host);
})();
