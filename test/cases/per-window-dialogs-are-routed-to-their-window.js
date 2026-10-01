'use strict';
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App, system } = require('../../lib/index.js');
const { Text } = require('../../lib/view.js');

const w1 = App('One', () => Text('A'));
App('Two', () => Text('B'));

(async () => {
  await tick(10);

  // A dialog on the handle must be parented to that window.
  const p = w1.confirm('sure?');
  const req = host.of('request').at(-1);
  assert.ok(req, 'a request should have been sent');
  assert.strictEqual(req.window, 1, 'request should be tagged with its window');
  assert.strictEqual(req.method, 'alert');
  assert.deepStrictEqual(req.args.buttons, ['OK', 'Cancel']);

  // The bare `system` API follows whichever window is focused.
  host.fromHost({ type: 'focus', window: 2 });
  system.alert('from focused');
  assert.strictEqual(host.of('request').at(-1).window, 2, 'system.* should follow focus');

  host.fromHost({ type: 'response', window: req.window, id: req.id, result: 0 });
  assert.strictEqual(await p, true, 'confirm should resolve true for the primary button');

  host.fromHost({ type: 'response', window: req.window, id: req.id, result: 1 });
  console.log('dialogs routed to the right window and resolved');
  done(host);
})();
