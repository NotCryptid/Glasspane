#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { startInHost, ensureHost } = require('../lib/launch');
const { pack, invokeDir } = require('../lib/pack');

const args = process.argv.slice(2);
const [cmd, ...rest] = args;

const fail = (msg, code = 1) => { console.error(msg); process.exit(code); };

function runPack(parseArgs) {
  const opts = {};
  const positional = [];
  const value = (flag, i) => {
    if (i >= parseArgs.length || parseArgs[i].startsWith('-')) fail(`Missing value for ${flag}.`, 2);
    return parseArgs[i];
  };
  for (let i = 0; i < parseArgs.length; i++) {
    const a = parseArgs[i];
    if (a === '-o' || a === '--out') opts.out = value(a, ++i);
    else if (a === '-i' || a === '--icon') opts.icon = value(a, ++i);
    else if (a === '-n' || a === '--name') opts.name = value(a, ++i);
    else if (a === '--id') opts.id = value(a, ++i);
    else if (a.startsWith('-')) fail(`Unknown option: ${a}`, 2);
    else positional.push(a);
  }
  if (positional.length > 1) fail('pack takes at most one script or folder.', 2);
  if (opts.icon) opts.icon = path.resolve(invokeDir(), opts.icon);
  pack(positional[0], opts)
    .then((r) => console.log(process.platform === 'darwin' ? `Packaged: ${r.exe}` : `Packaged: ${r.exe}\nShip the whole folder: ${r.out}`))
    .catch((e) => fail(e.message));
}

if (cmd === '--help' || cmd === '-h') {
  console.log('usage: glasspane [app.js] [args...]\n' +
    '       glasspane                                compile the current folder\n' +
    '       glasspane build                          build the host\n' +
    '       glasspane pack [app.js] [-o dir] [-n name] [-i icon.png]   package the app as a standalone <name> folder with <name>.exe (Windows) or <name>.app (macOS)\n' +
    '       glasspane icon <app.exe> <icon.png>      change the icon of an exe (Windows)');
  process.exit(0);
}

if (cmd === 'build') {
  ensureHost();
} else if (cmd === 'icon') {
  if (rest.length !== 2) fail('usage: glasspane icon <app.exe> <icon.png>', 2);
  require('../lib/pack').setIcon(path.resolve(invokeDir(), rest[0]), path.resolve(invokeDir(), rest[1]))
    .then(() => console.log('Icon updated.'))
    .catch((e) => fail(e.message));
} else if (cmd === 'pack') {
  runPack(rest);
} else if (cmd === undefined || cmd.startsWith('-')) {
  // No script given: compile the current folder (options are pack options).
  runPack(args);
} else {
  const script = path.resolve(invokeDir(), cmd);
  if (!fs.existsSync(script) || !fs.statSync(script).isFile()) fail(`Script not found: ${script}`);
  startInHost(script, rest);
}
