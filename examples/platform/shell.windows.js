'use strict';

const { spawn } = require('node:child_process');

module.exports = {
  shortcut: 'Ctrl+S',
  revealLabel: 'Show in Explorer',
  reveal: (file) => spawn('explorer.exe', [`/select,${file}`], { detached: true, stdio: 'ignore' }).unref(),
};
