'use strict';
// Views that both SwiftUI and WinUI have: their wire format, their bindings, and the overlays
// (popover, sheet, context menu) that hang off any view.
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const g = require('../../lib/index.js');
const { App, state, VStack, Text, Button } = g;

const when = state(new Date(2026, 0, 15, 9, 30));
const tint = state('#112233');
const tab = state(0);
const open = state(true);
const sheet = state(true);
const expanded = state(false);
const clicked = [];

App('Shared', () =>
  VStack(
    g.DatePicker('Date', when, { min: new Date(2026, 0, 1) }),
    g.DatePicker('Time', when, { mode: 'time' }),
    g.ColorPicker('Tint', tint, { alpha: true }),
    g.TabView(tab, g.Tab('One', Text('1'), Text('also 1')).icon('home'), g.Tab('Two', Text('2'))),
    g.SplitView(Text('side'), Text('detail'), { sidebarWidth: 180 }),
    g.DisclosureGroup('More', { expanded }, Text('a'), Text('b')),
    g.Grid({ hSpacing: 4 }, g.GridRow(Text('a'), Text('b')), [g.GridRow(Text('c'))]),
    g.Menu('Actions', g.MenuItem('New', () => clicked.push('new')).shortcut('CmdOrCtrl+N'), g.Divider(), g.Menu('Sub', g.MenuItem('Deep', () => clicked.push('deep')))),
    g.RoundedRectangle(6).foreground(g.LinearGradient(['red', { color: 'blue', at: 0.25 }], 'leading', [1, 0.5])).stroke('red', 2),
    Button('Anchor', () => {})
      .popover(open, { edge: 'top' }, Text('p1'), Text('p2'))
      .sheet(sheet, Text('s'))
      .contextMenu(g.MenuItem('Copy', () => clicked.push('copy')), false)
      .onHover((on) => clicked.push(on ? 'in' : 'out'))
      .onDoubleTap(() => clicked.push('double'))
      .offset(3, 4).rotation(10).scale(2).zIndex(5).hitTesting(false)
      .accessibilityLabel('Anchor').underline().tracking(1),
    g.Label('Starred', 'heart'),
    g.Link('Site', 'https://example.com'),
    g.SearchField('Find', state('')),
  )
);

const find = (node, pred, out = []) => {
  if (pred(node)) out.push(node);
  for (const c of node.c || []) find(c, pred, out);
  return out;
};
const one = (root, t) => find(root, (n) => n.t === t)[0];

(async () => {
  await tick(10);
  const root = host.last(1).root;

  // Dates travel as epoch milliseconds, with the range converted too.
  const [date, time] = find(root, (n) => n.t === 'DatePicker');
  assert.strictEqual(date.p.value, new Date(2026, 0, 15, 9, 30).getTime());
  assert.strictEqual(date.p.min, new Date(2026, 0, 1).getTime());
  assert.strictEqual(time.p.mode, 'time');

  // A host-side pick arrives as milliseconds and the binding holds a Date again.
  const picked = new Date(2026, 1, 3, 9, 30).getTime();
  host.fromHost({ type: 'event', window: 1, id: date.e.change, value: picked, seq: 1 });
  await tick(10);
  assert.ok(when.value instanceof Date && when.value.getTime() === picked, 'a date pick writes a Date back');

  host.fromHost({ type: 'event', window: 1, id: one(root, 'ColorPicker').e.change, value: '#FFAABBCC', seq: 2 });
  await tick(10);
  assert.strictEqual(tint.value, '#FFAABBCC');

  // Tabs: the index is bound, and a tab with several children gets an implicit VStack.
  const tabs = one(root, 'TabView');
  assert.strictEqual(tabs.p.selected, 0);
  assert.deepStrictEqual(tabs.c.map((t) => t.t), ['Tab', 'Tab']);
  assert.strictEqual(tabs.c[0].p.icon.length > 0, true);
  assert.strictEqual(tabs.c[0].c.length, 1);
  assert.strictEqual(tabs.c[0].c[0].t, 'VStack');
  host.fromHost({ type: 'event', window: 1, id: tabs.e.change, value: 1, seq: 3 });
  await tick(10);
  assert.strictEqual(tab.value, 1);
  assert.strictEqual(one(host.last(1).root, 'TabView').p.selected, 1);

  // SplitView holds exactly a sidebar and a detail.
  const split = one(root, 'SplitView');
  assert.strictEqual(split.p.sidebarWidth, 180);
  assert.strictEqual(split.c.length, 2);

  // DisclosureGroup is controlled by the binding it is given.
  const group = one(root, 'DisclosureGroup');
  assert.strictEqual(group.p.expanded, false);
  assert.strictEqual(group.c[0].t, 'VStack');
  host.fromHost({ type: 'event', window: 1, id: group.e.change, value: true, seq: 4 });
  await tick(10);
  assert.strictEqual(expanded.value, true);

  // Grid flattens its rows and records their lengths.
  const grid = one(root, 'Grid');
  assert.deepStrictEqual(grid.p.rows, [2, 1]);
  assert.strictEqual(grid.p.hSpacing, 4);
  assert.strictEqual(grid.c.length, 3);
  assert.throws(() => g.Grid(Text('not a row')), /GridRow/);

  // Menu entries are plain nodes with click ids.
  const menu = one(root, 'Menu');
  assert.deepStrictEqual(menu.c.map((n) => n.t), ['MenuItem', 'Divider', 'Menu']);
  assert.strictEqual(menu.c[0].p.shortcut, 'CmdOrCtrl+N');
  host.fromHost({ type: 'event', window: 1, id: menu.c[2].c[0].e.click, seq: 5 });
  await tick(10);
  assert.deepStrictEqual(clicked, ['deep']);

  // A gradient is data, not a color string.
  const rect = one(root, 'RoundedRectangle');
  assert.strictEqual(rect.p.radius, 6);
  assert.deepStrictEqual(rect.p.foreground.gradient.stops, [{ color: 'red', at: 0 }, { color: 'blue', at: 0.25 }]);
  assert.deepStrictEqual(rect.p.foreground.gradient.start, [0, 0.5]);
  assert.deepStrictEqual(rect.p.foreground.gradient.end, [1, 0.5]);
  assert.deepStrictEqual(rect.p.stroke, { color: 'red', width: 2 });
  assert.throws(() => g.LinearGradient(['red']), /two colors/);
  assert.throws(() => g.LinearGradient(['red', 'blue'], 'sideways'), /Unknown gradient point/);

  // Overlays hang off the view without becoming children.
  const anchor = find(root, (n) => n.t === 'Button' && n.p.text === 'Anchor')[0];
  assert.strictEqual(anchor.c, undefined);
  assert.strictEqual(anchor.p.popoverOpen, true);
  assert.strictEqual(anchor.p.popoverEdge, 'top');
  assert.strictEqual(anchor.o.popover.t, 'VStack', 'two popover views share an implicit VStack');
  assert.strictEqual(anchor.o.sheet.t, 'Text', 'a lone view stays itself');
  assert.strictEqual(anchor.o.contextMenu.length, 1);
  assert.deepStrictEqual(
    [anchor.p.offsetX, anchor.p.offsetY, anchor.p.rotation, anchor.p.scaleX, anchor.p.scaleY, anchor.p.zIndex, anchor.p.hitTesting],
    [3, 4, 10, 2, 2, 5, false]);
  assert.strictEqual(anchor.p.a11yLabel, 'Anchor');

  // Dismissing from the host closes the bound state; closing it from code closes the panel.
  host.fromHost({ type: 'event', window: 1, id: anchor.e.popoverDismiss, value: false, seq: 6 });
  await tick(10);
  assert.strictEqual(open.value, false);
  const after = find(host.last(1).root, (n) => n.t === 'Button' && n.p.text === 'Anchor')[0];
  assert.strictEqual(after.p.popoverOpen, false);
  host.fromHost({ type: 'event', window: 1, id: anchor.e.sheetDismiss, value: false, seq: 7 });
  await tick(10);
  assert.strictEqual(sheet.value, false);

  // Context menu clicks and pointer events reach their handlers.
  host.fromHost({ type: 'event', window: 1, id: anchor.o.contextMenu[0].e.click, seq: 8 });
  host.fromHost({ type: 'event', window: 1, id: anchor.e.hover, value: true, seq: 9 });
  host.fromHost({ type: 'event', window: 1, id: anchor.e.doubleTap, seq: 10 });
  await tick(10);
  assert.deepStrictEqual(clicked.slice(1), ['copy', 'in', 'double']);

  console.log('shared views serialized and routed');
  done(host);
})();
