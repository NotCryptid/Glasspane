'use strict';

// Publishes the WinUI host (native/Host) to native/Host/bin/publish.
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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
