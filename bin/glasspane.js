#!/usr/bin/env node
'use strict';

const { startInHost, ensureHost } = require('../lib/launch');

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log('usage: glasspane <app.js> [args...]\n       glasspane build     build the host');
  process.exit(cmd ? 0 : 2);
}
if (cmd === 'build') {
  ensureHost();
  process.exit(0);
}
startInHost(cmd, rest);
