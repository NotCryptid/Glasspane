'use strict';
// The host sends `closed` when the user closes a window. The app should exit only when the last
// one goes, not stay alive as a zombie.
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App } = require('../../lib/index.js');
const { Text } = require('../../lib/view.js');

App('One', () => Text('A'));
App('Two', () => Text('B'));

let exited = false;
process.on('exit', () => { exited = true; });

(async () => {
  await tick(10);

  // One of two windows closing must not end the process.
  host.fromHost({ type: 'closed', window: 1 });
  await tick(10);
  assert.strictEqual(exited, false, 'closing one window should not exit the process');

  // The last one closing should.
  host.fromHost({ type: 'closed', window: 2 });
  await tick(10);
  assert.strictEqual(exited, true, 'closing the last window should exit');
  console.log('process lifetime followed the last window');
  done(host);
})();
