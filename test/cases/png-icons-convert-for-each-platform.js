'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { icoFromPng, readPng, resolveIcon, toIco } = require('../../lib/icon.js');

const png = path.join(__dirname, '..', '..', 'examples', 'photos', 'icon.png');
const { width, height } = readPng(png);
assert.strictEqual(width, 1024);
assert.strictEqual(height, 1024);

// A 1024px PNG becomes a one-image .ico whose entry says 256 (stored as 0) and points at the PNG bytes.
const ico = icoFromPng(readPng(png));
assert.strictEqual(ico.readUInt16LE(2), 1, 'icon type');
assert.strictEqual(ico.readUInt16LE(4), 1, 'one image');
assert.strictEqual(ico[6], 0);
assert.strictEqual(ico.readUInt32LE(18), 22, 'image offset');
assert.ok(ico.subarray(22).equals(fs.readFileSync(png)), 'the PNG is embedded unchanged');

// Windows gets an .ico file, macOS keeps the PNG, and an .ico passes straight through.
const out = resolveIcon(png, 'win32');
assert.strictEqual(path.extname(out), '.ico');
assert.ok(fs.readFileSync(out).equals(ico));
assert.strictEqual(resolveIcon(png, 'darwin'), png);
assert.strictEqual(toIco(out), out);

// Bad input says what is wrong instead of failing later in the host.
const notPng = path.join(os.tmpdir(), 'glasspane-not-a-png.png');
fs.writeFileSync(notPng, 'hello');
assert.throws(() => resolveIcon(notPng, 'win32'), /Not a PNG/);
assert.throws(() => resolveIcon(path.join(os.tmpdir(), 'missing-icon.png')), /Icon not found/);
console.log('icons convert');
