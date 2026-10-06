'use strict';
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const { App, state } = require('../../lib/index.js');
const { Text } = require('../../lib/view.js');

const dark = state(false);
let saved = 0;
App({
  title: 'Menu',
  menu: () => [
    'edit',
    { label: 'File', items: [{ label: 'Save', shortcut: 'CmdOrCtrl+S', onClick: () => { saved++; } }] },
    { label: 'View', items: [{ label: 'Dark', checked: dark.value, onClick: () => { dark.value = !dark.value; } }] },
  ],
}, () => Text('hi'));

(async () => {
  await tick(10);
  const config = () => host.last(1).config;
  assert.deepStrictEqual(config().menu.map((m) => m.label), ['Edit', 'File', 'View']);
  const save = config().menu[1].items[0];
  assert.strictEqual(save.accel, 'CmdOrCtrl+S');

  // The host reports the click by handler id, like any other event.
  host.fromHost({ type: 'event', window: 1, id: save.click, seq: 1 });
  await tick(10);
  assert.strictEqual(saved, 1, 'the menu item handler should run');

  // A menu that reads state follows it: the checkmark flips after the click and the id still works.
  assert.strictEqual(config().menu[2].items[0].checked, false);
  host.fromHost({ type: 'event', window: 1, id: config().menu[2].items[0].click, seq: 2 });
  await tick(10);
  assert.strictEqual(dark.value, true);
  assert.strictEqual(config().menu[2].items[0].checked, true, 'the menu should re-render with the new state');
  console.log('menu clicks and state work');
  done(host);
})();
