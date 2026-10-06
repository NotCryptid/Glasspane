'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
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

/** Sets the icon of a Windows exe (.ico or .png file). Works on any exe, including an already packaged one. */
async function setIcon(exe, icon) {
  if (process.platform !== 'win32') throw new Error('Changing an exe icon only works on Windows. On macOS, pass a .png or .icns to `pack -i`.');
  exe = path.resolve(exe);
  if (!fs.existsSync(exe)) throw new Error(`Exe not found: ${exe}`);
  await require('rcedit')(exe, { icon: require('./icon').toIco(icon) });
}

/** The Node.js executable to bundle, preferring an explicit path then the one running this process. */
function findNode(platform = process.platform) {
  const name = platform === 'win32' ? 'node.exe' : 'node';
  const explicit = process.env.GLASSPANE_NODE;
  if (explicit && fs.existsSync(explicit)) return explicit;
  if (process.execPath && /node(\.exe)?$/i.test(process.execPath) && fs.existsSync(process.execPath)) return process.execPath;
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    const exe = path.join(dir.trim(), name);
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

function appName(script, pkg, opts) {
  return (opts.name || pkg.productName || pkg.name || path.basename(script, '.js')).replace(/^@[^/]*\//, '').replace(/[<>:"/\\|?*]/g, '_');
}

/** Copies the project into `app`, and makes sure `require('@cryptidbleh/glasspane')` resolves inside it. */
function copyProject(root, app, out, pkg) {
  const isSelf = pkg.name === SELF;
  const skip = new Set(['.git', 'dist']);
  if (isSelf) skip.add('native');
  copyTree(root, app, (src) => !inside(src, out) && !skip.has(path.relative(root, src).split(path.sep)[0]));

  const vendored = path.join(app, 'node_modules', ...SELF.split('/'));
  if (!isSelf && !fs.existsSync(vendored)) {
    fs.mkdirSync(vendored, { recursive: true });
    fs.cpSync(path.join(ROOT, 'lib'), path.join(vendored, 'lib'), { recursive: true });
    for (const f of ['package.json', 'index.d.ts']) fs.copyFileSync(path.join(ROOT, f), path.join(vendored, f));
  }
}

/**
 * Packages `script` into a standalone app: a `<Name>.exe` folder on Windows, a `<Name>.app` bundle
 * on macOS. The result needs no installed Node, .NET, Swift or Glasspane.
 */
async function pack(script, opts = {}) {
  script = path.resolve(script);
  if (!fs.existsSync(script)) throw new Error(`Script not found: ${script}`);
  const platform = opts.platform || process.platform;
  const root = findProjectRoot(script);
  const pkg = readJson(path.join(root, 'package.json'));
  const name = appName(script, pkg, opts);
  const main = path.relative(root, script).split(path.sep).join('/');
  const icon = opts.icon || (pkg.glasspane && pkg.glasspane.icon && path.resolve(root, pkg.glasspane.icon));
  const ctx = { script, root, pkg, name, main, icon, opts };
  return platform === 'darwin' ? packMac(ctx) : packWindows(ctx);
}

async function packWindows({ root, pkg, name, main, icon, opts }) {
  const out = path.resolve(opts.out || path.join(root, 'dist', name));

  if (inside(root, out)) throw new Error(`Output folder ${out} would contain the project.`);
  const hostExe = ensureHost();
  const hostDir = path.dirname(hostExe);

  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(hostDir, out, { recursive: true });
  fs.renameSync(path.join(out, path.basename(hostExe)), path.join(out, `${name}.exe`));
  // WinUI loads its resources from <exe name>.pri, so the renamed exe needs its own copy.
  const pri = path.join(out, path.basename(hostExe, '.exe') + '.pri');
  if (fs.existsSync(pri)) fs.renameSync(pri, path.join(out, `${name}.pri`));

  // Bundle the Node runtime so the packaged app runs without Node installed.
  const nodeExe = opts.node || findNode('win32');
  if (nodeExe) fs.copyFileSync(nodeExe, path.join(out, 'node.exe'));
  else console.error('[glasspane] Could not find node.exe to bundle; the app will need Node on PATH.');

  copyProject(root, path.join(out, 'app'), out, pkg);

  if (icon) await setIcon(path.join(out, `${name}.exe`), icon);

  fs.writeFileSync(path.join(out, 'glasspane.json'), JSON.stringify({ main: `app/${main}` }, null, 2) + '\n');
  return { out, exe: path.join(out, `${name}.exe`) };
}

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The Info.plist for a packaged macOS app. */
function infoPlist({ name, id, version, icon }) {
  const rows = {
    CFBundleName: name,
    CFBundleDisplayName: name,
    CFBundleExecutable: name,
    CFBundleIdentifier: id,
    CFBundlePackageType: 'APPL',
    CFBundleShortVersionString: version,
    CFBundleVersion: version,
    LSMinimumSystemVersion: '27.0',
    NSPrincipalClass: 'NSApplication',
  };
  if (icon) rows.CFBundleIconFile = icon;
  const body = Object.entries(rows).map(([k, v]) => `  <key>${k}</key>\n  <string>${xml(v)}</string>`).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
    `<plist version="1.0">\n<dict>\n${body}\n  <key>NSHighResolutionCapable</key>\n  <true/>\n</dict>\n</plist>\n`;
}

/** A Node built against Homebrew libraries only runs on machines that have them. */
function warnIfNotSelfContained(nodeExe) {
  if (process.platform !== 'darwin') return;
  const r = spawnSync('otool', ['-L', nodeExe], { encoding: 'utf8' });
  if (r.status === 0 && /\/(opt\/homebrew|usr\/local\/(opt|Cellar|lib))\//.test(r.stdout)) {
    console.error('[glasspane] This node links Homebrew libraries, so the app will not run on a Mac without them. ' +
      'Use the build from nodejs.org (set GLASSPANE_NODE to it) when you ship the app.');
  }
}

async function packMac({ root, pkg, name, main, icon, opts }) {
  const out = path.resolve(opts.out || path.join(root, 'dist', `${name}.app`));
  if (inside(root, out)) throw new Error(`Output ${out} would contain the project.`);
  const hostExe = ensureHost();

  fs.rmSync(out, { recursive: true, force: true });
  const macos = path.join(out, 'Contents', 'MacOS');
  const res = path.join(out, 'Contents', 'Resources');
  fs.mkdirSync(macos, { recursive: true });
  fs.mkdirSync(res, { recursive: true });
  fs.copyFileSync(hostExe, path.join(macos, name));
  fs.chmodSync(path.join(macos, name), 0o755);

  const nodeExe = opts.node || findNode('darwin');
  if (nodeExe) {
    fs.copyFileSync(nodeExe, path.join(res, 'node'));
    fs.chmodSync(path.join(res, 'node'), 0o755);
    warnIfNotSelfContained(nodeExe);
  } else console.error('[glasspane] Could not find node to bundle; the app will need Node installed.');

  copyProject(root, path.join(res, 'app'), out, pkg);
  fs.writeFileSync(path.join(res, 'glasspane.json'), JSON.stringify({ main: `app/${main}` }, null, 2) + '\n');

  let iconFile;
  if (icon) {
    require('./icon').toIcns(icon, path.join(res, 'AppIcon.icns'));
    iconFile = 'AppIcon';
  }

  const id = opts.id || (pkg.glasspane && pkg.glasspane.bundleId) ||
    'com.glasspane.' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  fs.writeFileSync(path.join(out, 'Contents', 'Info.plist'), infoPlist({ name, id, version: pkg.version || '1.0.0', icon: iconFile }));

  // Apple Silicon refuses unsigned code, and changing the bundle invalidates the build's signature,
  // so sign ad hoc. Distributing to other Macs still needs a Developer ID signature and notarization.
  if (process.platform === 'darwin') {
    const r = spawnSync('codesign', ['--force', '--deep', '--sign', '-', out], { encoding: 'utf8' });
    if (r.status !== 0) console.error('[glasspane] codesign failed: ' + (r.stderr || '').trim());
  }
  return { out, exe: out };
}

module.exports = { pack, setIcon, infoPlist };
