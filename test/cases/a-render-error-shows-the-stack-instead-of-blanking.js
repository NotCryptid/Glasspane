'use strict';
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App } = require('../../lib/index.js');
const { Text } = require('../../lib/view.js');

let boom = false;
App('One', () => {
  if (boom) throw new Error('body exploded');
  return Text('fine');
});

(async () => {
  await tick(10);
  assert.strictEqual(host.last(1).root.t, 'Text', 'healthy render first');

  boom = true;
  host.fromHost({ type: 'event', window: 1, id: 'anything', seq: 1 });
  await tick(10);

  const root = host.last(1).root;
  assert.strictEqual(root.t, 'VStack', 'error view should replace the tree');
  const title = root.c[0].p.text;
  const detail = root.c[1].c[0].p.text;
  assert.match(title, /Error while rendering/);
  assert.match(detail, /body exploded/, 'the stack should name the error');
  assert.strictEqual(root.c[1].c[0].p.selectable, true, 'detail should be selectable');
  assert.strictEqual(root.c[1].c[0].p.fontFamily, 'Cascadia Mono', 'detail should be monospace');
  console.log('render error rendered the stack trace');
  done(host);
})();
