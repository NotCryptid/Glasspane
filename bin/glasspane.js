#!/usr/bin/env node
'use strict';

const { startInHost, ensureHost } = require('../lib/launch');

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log('usage: glasspane <app.js> [args...]\n       glasspane build                          build the host\n       glasspane pack <app.js> [-o dir] [-n name]   package the app as a standalone <name>.exe folder');
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
    else if (rest[i] === '-n' || rest[i] === '--name') opts.name = rest[++i];
    else script = rest[i];
  }
  if (!script) { console.error('usage: glasspane pack <app.js> [-o dir] [-n name]'); process.exit(2); }
  try {
    const r = pack(script, opts);
    console.log(`Packaged: ${r.exe}\nShip the whole folder: ${r.out}`);
  } catch (e) { console.error(e.message); process.exit(1); }
  process.exit(0);
}
startInHost(cmd, rest);
