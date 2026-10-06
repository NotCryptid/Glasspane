'use strict';

// One source image for every platform. Apps point at a PNG (a square one, 512px or larger is best)
// and Glasspane makes what each OS wants: an .ico for Windows, an .icns for macOS. Existing .ico and
// .icns files still work as they are.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPng(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`Not a PNG file: ${file}`);
  return { buf, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** An .ico that holds the PNG as its only image. Windows has accepted PNG-compressed icons since Vista. */
function icoFromPng({ buf, width, height }) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(1, 2);              // type: icon
  head.writeUInt16LE(1, 4);              // one image
  head[6] = width >= 256 ? 0 : width;    // 0 means 256
  head[7] = height >= 256 ? 0 : height;
  head.writeUInt16LE(1, 10);             // planes
  head.writeUInt16LE(32, 12);            // bits per pixel
  head.writeUInt32LE(buf.length, 14);
  head.writeUInt32LE(22, 18);            // image data starts right after the header
  return Buffer.concat([head, buf]);
}

/** Generated files live here, keyed by the source file and its modification time. */
function cached(src, ext, make) {
  const st = fs.statSync(src);
  const key = crypto.createHash('sha1').update(`${path.resolve(src)}:${st.mtimeMs}:${st.size}`).digest('hex').slice(0, 16);
  const dir = path.join(os.tmpdir(), 'glasspane-icons');
  const out = path.join(dir, `${key}${ext}`);
  if (!fs.existsSync(out)) {
    fs.mkdirSync(dir, { recursive: true });
    make(out);
  }
  return out;
}

function need(src) {
  src = path.resolve(src);
  if (!fs.existsSync(src)) throw new Error(`Icon not found: ${src}`);
  return src;
}

/** A path to an .ico for `src` (.ico or .png). */
function toIco(src) {
  src = need(src);
  const ext = path.extname(src).toLowerCase();
  if (ext === '.ico') return src;
  if (ext !== '.png') throw new Error(`On Windows the icon must be a .png or .ico file: ${src}`);
  return cached(src, '.ico', (out) => fs.writeFileSync(out, icoFromPng(readPng(src))));
}

/** Writes an .icns for `src` (.icns or .png) to `dest`. A PNG is scaled to every size the Dock and Finder use. */
function toIcns(src, dest) {
  src = need(src);
  const ext = path.extname(src).toLowerCase();
  if (ext === '.icns') { fs.copyFileSync(src, dest); return dest; }
  if (ext !== '.png') throw new Error(`On macOS the icon must be a .png or .icns file: ${src}`);
  if (process.platform !== 'darwin') throw new Error('Converting a PNG to .icns needs macOS. Pass an .icns file instead.');
  const { width, height } = readPng(src);
  const small = Math.min(width, height);
  const set = fs.mkdtempSync(path.join(os.tmpdir(), 'glasspane-iconset-')) + '.iconset';
  fs.mkdirSync(set);
  try {
    for (const px of [16, 32, 64, 128, 256, 512, 1024]) {
      if (px > small && px !== 16) continue; // never scale up, but always have something
      const r = spawnSync('sips', ['-z', String(px), String(px), src, '--out', path.join(set, `s${px}.png`)], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`Could not scale ${src}: ${r.stderr}`);
    }
    // iconutil names: icon_<n>x<n>.png and icon_<n>x<n>@2x.png (which is 2n pixels).
    for (const [name, px] of [['16x16', 16], ['16x16@2x', 32], ['32x32', 32], ['32x32@2x', 64], ['128x128', 128],
      ['128x128@2x', 256], ['256x256', 256], ['256x256@2x', 512], ['512x512', 512], ['512x512@2x', 1024]]) {
      const from = path.join(set, `s${px}.png`);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(set, `icon_${name}.png`));
    }
    for (const f of fs.readdirSync(set)) if (f.startsWith('s')) fs.rmSync(path.join(set, f));
    const r = spawnSync('iconutil', ['-c', 'icns', set, '-o', dest], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`Could not build the .icns: ${r.stderr}`);
  } finally {
    fs.rmSync(set, { recursive: true, force: true });
  }
  return dest;
}

/**
 * The one entry point: whatever the app gave us, as a file the running host can load on this
 * platform. Windows needs an .ico; the Mac host reads a PNG or .icns directly.
 */
function resolveIcon(src, platform = process.platform) {
  src = need(src);
  return platform === 'win32' ? toIco(src) : src;
}

module.exports = { resolveIcon, toIco, toIcns, icoFromPng, readPng };
