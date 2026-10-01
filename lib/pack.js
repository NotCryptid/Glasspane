'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ensureHost } = require('./launch');

const ROOT = path.resolve(__dirname, '..');
const SELF = '@cryptidbleh/glasspane';

function findProjectRoot(script) {
  for (let d = path.dirname(script); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'package.json'))) return d;
    if (d === path.dirname(d)) return path.dirname(script);
  }
}

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; } };
const inside = (child, parent) => { const r = path.relative(parent, child); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

// fs.cpSync refuses to copy a folder into one of its own subfolders, which `dist/` is.
function copyTree(from, to, keep) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name);
    if (!keep(src)) continue;
    if (e.isDirectory()) copyTree(src, path.join(to, e.name), keep);
    else fs.copyFileSync(src, path.join(to, e.name));
  }
}

/** Sets the icon of a Windows exe (.ico file). Works on any exe, including an already packaged one. */
async function setIcon(exe, icon) {
  exe = path.resolve(exe); icon = path.resolve(icon);
  if (!fs.existsSync(exe)) throw new Error(`Exe not found: ${exe}`);
  if (path.extname(icon).toLowerCase() !== '.ico' || !fs.existsSync(icon)) throw new Error(`Icon must be an existing .ico file: ${icon}`);
  await require('rcedit')(exe, { icon });
}

/**
 * Packages `script` into a standalone folder: `<out>/<Name>.exe` plus the host runtime and an `app/`
 * copy of the project. The result runs without Node, .NET or Glasspane installed.
 */
async function pack(script, opts = {}) {
  script = path.resolve(script);
  if (!fs.existsSync(script)) throw new Error(`Script not found: ${script}`);
  const root = findProjectRoot(script);
  const pkg = readJson(path.join(root, 'package.json'));
  const name = (opts.name || pkg.productName || pkg.name || path.basename(script, '.js')).replace(/^@[^/]*\//, '').replace(/[<>:"/\\|?*]/g, '_');
  const out = path.resolve(opts.out || path.join(root, 'dist', name));

  if (inside(root, out)) throw new Error(`Output folder ${out} would contain the project.`);
  const hostExe = ensureHost();
  const hostDir = path.dirname(hostExe);

  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(hostDir, out, { recursive: true });
  fs.renameSync(path.join(out, path.basename(hostExe)), path.join(out, `${name}.exe`));

  const isSelf = pkg.name === SELF;
  const skip = new Set(['.git', 'dist']);
  if (isSelf) skip.add('native');
  const app = path.join(out, 'app');
  copyTree(root, app, (src) => !inside(src, out) && !skip.has(path.relative(root, src).split(path.sep)[0]));

  // Make sure `require('@cryptidbleh/glasspane')` resolves when the project doesn't install it itself.
  const vendored = path.join(app, 'node_modules', ...SELF.split('/'));
  if (!isSelf && !fs.existsSync(vendored)) {
    fs.mkdirSync(vendored, { recursive: true });
    fs.cpSync(path.join(ROOT, 'lib'), path.join(vendored, 'lib'), { recursive: true });
    for (const f of ['package.json', 'index.d.ts']) fs.copyFileSync(path.join(ROOT, f), path.join(vendored, f));
  }

  const icon = opts.icon || (pkg.glasspane && pkg.glasspane.icon && path.resolve(root, pkg.glasspane.icon));
  if (icon) await setIcon(path.join(out, `${name}.exe`), icon);

  const main = path.relative(root, script).split(path.sep).join('/');
  fs.writeFileSync(path.join(out, 'glasspane.json'), JSON.stringify({ main: `app/${main}` }, null, 2) + '\n');
  return { out, exe: path.join(out, `${name}.exe`) };
}

module.exports = { pack, setIcon };
