'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

// The host is a WinUI window on Windows and a SwiftUI window on macOS; the app's JavaScript runs in
// a stock Node.js child process that the host talks to over stdio. Node is located via
// GLASSPANE_NODE, the packaged folder, or PATH.
const ROOT = path.resolve(__dirname, '..');
const MAC = process.platform === 'darwin';
const HOST_EXE = MAC
  ? path.join(ROOT, 'native', 'MacHost', 'bin', 'Glasspane')
  : path.join(ROOT, 'native', 'Host', 'bin', 'publish', 'Glasspane.exe');

/** Apps need Windows 11 25H2 (build 26200) or macOS 27; Darwin 27 is macOS 27. */
function checkOS() {
  const [major, , build] = os.release().split('.').map(Number);
  // Written so an unparseable version (NaN) fails the check rather than passing it.
  const supported = MAC ? major >= 27 : (process.platform !== 'win32' || (major === 10 && build >= 26200) || major > 10);
  if (!supported) {
    throw new Error(MAC ? 'Glasspane apps need macOS 27 or newer.'
      : 'Glasspane apps need Windows 11 25H2 (build 26200) or newer.');
  }
}

const HOST_SOURCES = MAC
  ? [path.join(ROOT, 'native', 'MacHost', 'Package.swift'), path.join(ROOT, 'native', 'MacHost', 'Sources')]
  : [path.join(ROOT, 'native', 'Host')];
const HOST_SOURCE_EXT = MAC ? ['.swift'] : ['.cs', '.csproj', '.manifest'];

/** Newest modification time among the host's source files, or 0 when there are none (an installed copy). */
function newestSourceTime() {
  let newest = 0;
  const visit = (p) => {
    let st;
    try { st = fs.statSync(p); } catch { return; }
    if (st.isDirectory()) {
      if (['bin', 'obj', '.build'].includes(path.basename(p))) return;
      for (const f of fs.readdirSync(p)) visit(path.join(p, f));
    } else if (path.basename(p) === 'Package.swift' || HOST_SOURCE_EXT.includes(path.extname(p))) {
      newest = Math.max(newest, st.mtimeMs);
    }
  };
  HOST_SOURCES.forEach(visit);
  return newest;
}

function buildHost() {
  return spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-host.js')], { stdio: 'inherit' });
}

/**
 * Path to the host executable. It is built on first use, and rebuilt when its source files are newer
 * than the binary, so editing the native code never runs a stale host. GLASSPANE_HOST skips both.
 */
function ensureHost() {
  checkOS();
  const exe = process.env.GLASSPANE_HOST || HOST_EXE;
  if (process.env.GLASSPANE_HOST) {
    if (!fs.existsSync(exe)) throw new Error(`GLASSPANE_HOST points to a missing file: ${exe}`);
    return exe;
  }
  const exists = fs.existsSync(exe);
  if (exists && newestSourceTime() <= fs.statSync(exe).mtimeMs) return exe;
  console.error(exists ? '[glasspane] The host sources changed; rebuilding the host...'
    : '[glasspane] Building the host (first run only)...');
  const r = buildHost();
  if (r.status !== 0 || !fs.existsSync(exe)) {
    if (exists) {
      console.error('[glasspane] Rebuilding the host failed; using the previous build.');
      return exe;
    }
    throw new Error(MAC
      ? 'Could not build the host. Install Xcode or the Xcode Command Line Tools (Swift 5.9 or newer) and run `npm run build:host`.'
      : 'Could not build the host. Install the .NET SDK (10 or newer) and run `npm run build:host`.');
  }
  return exe;
}

/**
 * Starts `script` in the host and returns without waiting, so no launcher process stays behind.
 * Detached, because libuv would otherwise kill the child with this process. The host inherits
 * our stdio handles, so console.log still reaches the terminal.
 */
function startInHost(script, args = []) {
  const env = { ...process.env };
  const preload = path.join(ROOT, 'lib', 'preload.js').replace(/\\/g, '/');
  const requireArg = `--require "${preload}"`;
  env.NODE_OPTIONS = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ${requireArg}` : requireArg;
  const child = spawn(ensureHost(), [path.resolve(script), ...args], { stdio: 'inherit', detached: true, env });
  child.on('error', (e) => { console.error('[glasspane] failed to start host:', e.message); process.exit(1); });
  child.unref();
}

/**
 * Called when a script is started with plain `node app.js`: hand the script over to the host
 * and exit, so the app behaves the same either way. The host sets GLASSPANE_HOSTED, so its
 * own Node child does not relaunch and loop.
 */
function relaunchIfNeeded() {
  if (process.env.GLASSPANE_HOSTED || globalThis.__glasspane || !['win32', 'darwin'].includes(process.platform)) return;
  const script = process.argv[1];
  if (!script || !require.main || path.resolve(script) !== require.main.filename) return;
  startInHost(script, process.argv.slice(2));
  process.exit(0);
}

module.exports = { ensureHost, startInHost, relaunchIfNeeded };
