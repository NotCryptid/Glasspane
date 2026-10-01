'use strict';
// stdout carries the protocol, so app output must not be able to inject or corrupt messages.
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App } = require('../../lib/index.js');
const { Text } = require('../../lib/view.js');

App('One', () => Text('ok'));

// Every way user code tends to reach stdout.
console.log('a log line');
process.stdout.write('a stream write\n');
console.error('an error line');
console.warn('a warning');
console.table([{ a: 1 }]);

(async () => {
  await tick(10);
  const renders = host.renders();
  assert.ok(renders.length >= 1, 'the app should still have rendered');
  for (const r of renders) {
    assert.strictEqual(typeof r.window, 'number', 'every message should be intact JSON');
    assert.ok(r.root, 'every render should carry a root');
  }
  assert.strictEqual(host.last(1).root.p.text, 'ok', 'the app should be unaffected');

  // A forged message must not be smuggled onto the wire.
  process.stdout.write(JSON.stringify({ type: 'render', window: 99, root: { t: 'Text' } }) + '\n');
  await tick(10);
  assert.ok(!host.sent.some((m) => m.window === 99), 'a forged render should not reach the host');
  console.log('stdout pollution did not reach the protocol');
  done(host);
})();
