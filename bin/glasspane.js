#!/usr/bin/env node
'use strict';

const { startInHost, ensureHost } = require('../lib/launch');

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log('usage: glasspane <app.js> [args...]\n       glasspane build                          build the host\n       glasspane pack <app.js> [-o dir] [-n name] [-i icon.ico|icon.icns]   package the app as a standalone <name>.exe folder (Windows) or <name>.app (macOS)\n       glasspane icon <app.exe> <icon.ico>      change the icon of an exe (Windows)');
  process.exit(cmd ? 0 : 2);
}
if (cmd === 'build') {
  ensureHost();
  process.exit(0);
}
if (cmd === 'pack') {
  const { pack } = require('../lib/pack');
  const opts = {};
  let script;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '-o' || rest[i] === '--out') opts.out = rest[++i];
    else if (rest[i] === '-i' || rest[i] === '--icon') opts.icon = rest[++i];
    else if (rest[i] === '-n' || rest[i] === '--name') opts.name = rest[++i];
    else if (rest[i] === '--id') opts.id = rest[++i];
    else script = rest[i];
  }
  if (!script) { console.error('usage: glasspane pack <app.js> [-o dir] [-n name] [-i icon.ico|icon.icns] [--id com.you.app]'); process.exit(2); }
  pack(script, opts)
    .then((r) => console.log(process.platform === 'darwin' ? `Packaged: ${r.exe}` : `Packaged: ${r.exe}\nShip the whole folder: ${r.out}`))
    .catch((e) => { console.error(e.message); process.exit(1); });
} else if (cmd === 'icon') {
  if (rest.length !== 2) { console.error('usage: glasspane icon <app.exe> <icon.ico>'); process.exit(2); }
  require('../lib/pack').setIcon(rest[0], rest[1])
    .then(() => console.log('Icon updated.'))
    .catch((e) => { console.error(e.message); process.exit(1); });
} else startInHost(cmd, rest);
