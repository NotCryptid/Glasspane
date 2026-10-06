'use strict';
const assert = require('node:assert');
const { resolveMenu } = require('../../lib/menu.js');

const handlers = new Map();
const register = (fn) => { const id = `m${handlers.size}`; handlers.set(id, fn); return id; };
const mac = process.platform === 'darwin';

// Shorthand menus expand to the standard items, with this platform's shortcuts.
const [edit] = resolveMenu(['edit'], register);
assert.strictEqual(edit.label, 'Edit');
assert.deepStrictEqual(edit.items.map((i) => i.role || 'sep'), ['undo', 'redo', 'sep', 'cut', 'copy', 'paste', 'selectAll']);
assert.strictEqual(edit.items.find((i) => i.role === 'copy').accel, 'CmdOrCtrl+C');
assert.strictEqual(edit.items.find((i) => i.role === 'redo').accel, mac ? 'Cmd+Shift+Z' : 'Ctrl+Y');
assert.strictEqual(handlers.size, 0, 'standard items need no handler');

// Custom items trade their function for an id, and falsy entries (cond && item) are skipped.
let clicked = 0;
const menu = resolveMenu([
  false,
  { label: 'File', items: [
    { label: 'New', shortcut: 'CmdOrCtrl+N', onClick: () => { clicked++; } },
    false, '-',
    { label: 'Recent', items: [{ label: 'One', onClick() {} }] },
    { label: 'Sidebar', checked: true, enabled: false, onClick() {} },
  ] },
  'help',
], register);
assert.strictEqual(menu.length, 2);
const [file, help] = menu;
assert.deepStrictEqual(file.items.map((i) => i.label || 'sep'), ['New', 'sep', 'Recent', 'Sidebar']);
assert.strictEqual(file.items[0].accel, 'CmdOrCtrl+N');
assert.strictEqual(typeof file.items[0].click, 'string');
assert.strictEqual(typeof file.items[0].onClick, 'undefined', 'functions never reach the host');
handlers.get(file.items[0].click)();
assert.strictEqual(clicked, 1);
assert.strictEqual(file.items[2].items[0].label, 'One');
assert.strictEqual(file.items[3].checked, true);
assert.strictEqual(file.items[3].enabled, false);
assert.strictEqual(help.help, true);
JSON.stringify(menu); // plain data only

// A function is evaluated each time, so it can follow state.
let n = 0;
const dynamic = () => [{ label: 'Count', items: [{ label: `Clicked ${n}`, onClick() {} }] }];
assert.strictEqual(resolveMenu(dynamic, register)[0].items[0].label, 'Clicked 0');
n = 3;
assert.strictEqual(resolveMenu(dynamic, register)[0].items[0].label, 'Clicked 3');

assert.strictEqual(resolveMenu(undefined, register), undefined);
assert.throws(() => resolveMenu(['nope'], register), /Unknown standard menu/);
assert.throws(() => resolveMenu([{ label: 'X', items: [{ role: 'explode' }] }], register), /Unknown menu role/);
assert.throws(() => resolveMenu([{ label: 'X', items: [{ onClick() {} }] }], register), /needs a label/);
console.log('menus resolve');
