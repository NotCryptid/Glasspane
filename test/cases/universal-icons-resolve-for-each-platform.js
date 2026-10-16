'use strict';

const assert = require('node:assert');
const { createHost, done } = require('../harness');

const host = createHost();
const { resolveSymbol, icons, Icon, Button, system } = require('../../lib/index.js');

// 1. Universal icon names resolve for both platforms (case-insensitive)
assert.strictEqual(resolveSymbol('photos', 'windows'), 'Pictures');
assert.strictEqual(resolveSymbol('photos', 'macos'), 'photo.on.rectangle');
assert.strictEqual(resolveSymbol('SEARCH', 'win32'), 'Find');
assert.strictEqual(resolveSymbol('SEARCH', 'darwin'), 'magnifyingglass');
assert.strictEqual(resolveSymbol('landscape', 'windows'), 'Map');
assert.strictEqual(resolveSymbol('landscape', 'macos'), 'mountain.2');

// 2. Direct per-platform object definitions ({ windows, macos }, { win, mac }, { symbol, sf })
assert.strictEqual(resolveSymbol({ windows: 'Pictures', macos: 'photo.on.rectangle' }, 'windows'), 'Pictures');
assert.strictEqual(resolveSymbol({ windows: 'Pictures', macos: 'photo.on.rectangle' }, 'macos'), 'photo.on.rectangle');
assert.strictEqual(resolveSymbol({ win: 'SaveLocal', mac: 'arrow.down.doc' }, 'windows'), 'SaveLocal');
assert.strictEqual(resolveSymbol({ win: 'SaveLocal', mac: 'arrow.down.doc' }, 'macos'), 'arrow.down.doc');
assert.strictEqual(resolveSymbol({ symbol: 'Globe', sf: 'moon.stars' }, 'windows'), 'Globe');
assert.strictEqual(resolveSymbol({ symbol: 'Globe', sf: 'moon.stars' }, 'macos'), 'moon.stars');

// 3. Explicit native prefixes (win:, symbol:, sf:, mac:)
assert.strictEqual(resolveSymbol('win:GlobalNavigationButton', 'windows'), 'GlobalNavigationButton');
assert.strictEqual(resolveSymbol('sf:sparkles.rectangle.stack', 'macos'), 'sparkles.rectangle.stack');
assert.strictEqual(resolveSymbol('sf:magnifyingglass', 'windows'), 'Find');
assert.strictEqual(resolveSymbol('win:Pictures', 'macos'), 'photo.on.rectangle');

// 4. Bidirectional native references (SF Symbol <-> Windows Symbol, including .fill / .circle variants)
assert.strictEqual(resolveSymbol('eye', 'windows'), 'View');
assert.strictEqual(resolveSymbol('eye', 'macos'), 'eye');
assert.strictEqual(resolveSymbol('View', 'windows'), 'View');
assert.strictEqual(resolveSymbol('View', 'macos'), 'eye');
assert.strictEqual(resolveSymbol('eye.fill', 'windows'), 'View');
assert.strictEqual(resolveSymbol('eye.fill', 'macos'), 'eye.fill');
assert.strictEqual(resolveSymbol('trash.circle.fill', 'windows'), 'Delete');
assert.strictEqual(resolveSymbol('Pictures', 'windows'), 'Pictures');
assert.strictEqual(resolveSymbol('Pictures', 'macos'), 'photo.on.rectangle');
assert.strictEqual(resolveSymbol('magnifyingglass', 'macos'), 'magnifyingglass');
assert.strictEqual(resolveSymbol('magnifyingglass', 'windows'), 'Find');
assert.strictEqual(resolveSymbol('custom.sf.symbol', 'macos'), 'custom.sf.symbol');

// 5. Icon(), Button().icon(), cornerRadiusMultiplier (3x default), and softCornerRadiusMultiplier (2x)
const expectedSearch = process.platform === 'darwin' ? 'magnifyingglass' : 'Find';
assert.strictEqual(Icon('search').props.name, expectedSearch);
assert.strictEqual(Button('Find').icon({ windows: 'Find', macos: 'magnifyingglass' }).props.icon, expectedSearch);
assert.strictEqual(system.cornerRadiusMultiplier, process.platform === 'darwin' ? 1 : 1 / 3);
assert.strictEqual(system.softCornerRadiusMultiplier, process.platform === 'darwin' ? 1 : 0.5);
assert.strictEqual(system.cornerScale, system.cornerRadiusMultiplier);
assert.strictEqual(system.softCornerScale, system.softCornerRadiusMultiplier);
assert.ok(Object.keys(icons).length >= 100);
done(host);
