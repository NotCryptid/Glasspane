'use strict';

// Builds the native host: the WinUI host (native/Host) on Windows, the SwiftUI host
// (native/MacHost) on macOS.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function buildMac() {
  const pkg = path.resolve(__dirname, '..', 'native', 'MacHost');
  const base = ['build', '-c', 'release', '--package-path', pkg];
  const r = spawnSync('swift', base, { stdio: 'inherit' });
  if (r.error && r.error.code === 'ENOENT') {
    console.error('Swift was not found. Install Xcode or run `xcode-select --install`, then retry.');
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
  const bin = spawnSync('swift', [...base, '--show-bin-path'], { encoding: 'utf8' }).stdout.trim();
  const out = path.join(pkg, 'bin');
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(path.join(bin, 'Glasspane'), path.join(out, 'Glasspane'));
  fs.chmodSync(path.join(out, 'Glasspane'), 0o755);
  process.exit(0);
}

function buildWindows() {
  const arm = process.arch === 'arm64';
  const project = path.resolve(__dirname, '..', 'native', 'Host', 'Glasspane.csproj');
  const out = path.resolve(__dirname, '..', 'native', 'Host', 'bin', 'publish');

  const args = [
    'publish', project, '-c', 'Release',
    '-r', arm ? 'win-arm64' : 'win-x64',
    `-p:Platform=${arm ? 'ARM64' : 'x64'}`,
    '-o', out, '--nologo', '-v', 'q',
  ];

  const r = spawnSync('dotnet', args, { stdio: 'inherit', shell: false });
  if (r.error && r.error.code === 'ENOENT') {
    console.error('The .NET SDK was not found. Install it from https://dotnet.microsoft.com/download and retry.');
    process.exit(1);
  }
  process.exit(r.status ?? 1);
}

if (process.platform === 'darwin') buildMac();
else buildWindows();
