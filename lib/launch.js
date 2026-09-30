'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const HOST_EXE = path.join(ROOT, 'native', 'Host', 'bin', 'publish', 'Glasspane.exe');

/** Path to the host executable, building it with the .NET SDK on first use. */
function ensureHost() {
  const exe = process.env.GLASSPANE_HOST || HOST_EXE;
  if (fs.existsSync(exe)) return exe;
  if (process.env.GLASSPANE_HOST) throw new Error(`GLASSPANE_HOST points to a missing file: ${exe}`);
  console.error('[glasspane] Building the host (first run only)...');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-host.js')], { stdio: 'inherit' });
  if (r.status !== 0 || !fs.existsSync(exe)) {
    throw new Error('Could not build the host. Install the .NET SDK (10 or newer) and run `npm run build:host`.');
  }
  return exe;
}

/**
 * Starts `script` in the host and returns without waiting, so no launcher process stays behind.
 * Detached, because libuv would otherwise kill the child with this process. The host inherits
 * our stdio handles, so console.log still reaches the terminal.
 */
function startInHost(script, args = []) {
  const child = spawn(ensureHost(), [path.resolve(script), ...args], { stdio: 'inherit', detached: true });
  child.on('error', (e) => { console.error('[glasspane] failed to start host:', e.message); process.exit(1); });
  child.unref();
}

/**
 * Called when a script is started with plain `node app.js`: hand the script over to the host
 * and exit, so the app behaves the same either way.
 */
function relaunchIfNeeded() {
  if (globalThis.__glasspane || process.platform !== 'win32') return;
  const script = process.argv[1];
  if (!script || !require.main || path.resolve(script) !== require.main.filename) return;
  startInHost(script, process.argv.slice(2));
  process.exit(0);
}

module.exports = { ensureHost, startInHost, relaunchIfNeeded };
