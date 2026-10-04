'use strict';

const { spawn } = require('node:child_process');

module.exports = {
  shortcut: '\u2318S',
  revealLabel: 'Reveal in Finder',
  reveal: (file) => spawn('open', ['-R', file], { detached: true, stdio: 'ignore' }).unref(),
};
