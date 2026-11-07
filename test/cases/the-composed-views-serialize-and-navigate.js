'use strict';
// Section, Form, Gauge, NavigationStack, LazyVStack, WebView, VideoPlayer, RadialGradient and
// Native().fallback, as the host sees them.
const assert = require('node:assert');
const { createHost, tick, done } = require('../harness');

const host = createHost();
const g = require('../../lib/index.js');
const { App, state, VStack, Text, Button } = g;

const pages = state([]);

App('Composed', () =>
  VStack(
    g.Form(g.Section('Account', Text('a'), Text('b')), g.Section(null, Text('c'))),
    g.Gauge('Disk', 128, { min: 0, max: 512 }),
    g.NavigationStack(pages, () => Button('Open', () => pages.update((p) => { p.push(() => Text('Detail')); })), { title: 'Files' }),
    g.LazyVStack(['x', 'y'], (s) => Text(s)),
    g.WebView('https://example.com'),
    g.WebView({ html: '<b>hi</b>' }),
    g.VideoPlayer('https://example.com/a.mp4', { autoplay: true }),
    g.RoundedRectangle(4).foreground(g.RadialGradient(['red', 'blue'], 'center', 0.4)),
    g.Native('RatingControl').fallback(Text('3 stars')),
  )
);

const find = (node, pred, out = []) => {
  if (pred(node)) out.push(node);
  for (const c of node.c || []) find(c, pred, out);
  return out;
};

(async () => {
  await tick(10);
  let root = host.last(1).root;

  // Section: a caption title, a card, and a divider between rows but not around them.
  const texts = find(root, (n) => n.t === 'Text').map((n) => n.p.text);
  assert.ok(texts.includes('ACCOUNT') || texts.includes('Account'));
  assert.strictEqual(find(root, (n) => n.t === 'Card').length, 2);
  assert.strictEqual(find(root, (n) => n.t === 'Divider').length, 1);

  const bar = find(root, (n) => n.t === 'ProgressView')[0];
  assert.strictEqual(bar.p.value, 0.25);

  const list = find(root, (n) => n.t === 'List')[0];
  assert.strictEqual(list.p.plain, true);
  assert.strictEqual(list.c.length, 2);

  const [web, html] = find(root, (n) => n.t === 'WebView');
  assert.strictEqual(web.p.url, 'https://example.com');
  assert.strictEqual(html.p.html, '<b>hi</b>');
  const video = find(root, (n) => n.t === 'VideoPlayer')[0];
  assert.strictEqual(video.p.autoplay, true);

  const rect = find(root, (n) => n.t === 'RoundedRectangle')[0];
  assert.strictEqual(rect.p.foreground.gradient.type, 'radial');
  assert.deepStrictEqual(rect.p.foreground.gradient.center, [0.5, 0.5]);

  // Native keeps itself on Windows and swaps for the fallback on macOS.
  const native = find(root, (n) => n.t === 'Native');
  if (process.platform === 'darwin') assert.strictEqual(native.length, 0);
  else assert.strictEqual(native.length, 1);

  // NavigationStack: Open pushes a page with a Back button, Back pops it.
  assert.strictEqual(find(root, (n) => n.t === 'Button' && n.p.text === 'Back').length, 0);
  host.click(1, 'Open');
  await tick(10);
  root = host.last(1).root;
  assert.ok(find(root, (n) => n.t === 'Text' && n.p.text === 'Detail').length);
  host.click(1, 'Back');
  await tick(10);
  root = host.last(1).root;
  assert.strictEqual(find(root, (n) => n.t === 'Text' && n.p.text === 'Detail').length, 0);

  console.log('composed views serialize and navigate');
  done(host);
})();
