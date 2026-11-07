'use strict';

const Module = require('node:module');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkgName = require('../package.json').name;

// Lets an app run from anywhere resolve `require('<this package>')` to this install.
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  try {
    return origResolve.apply(this, arguments);
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') {
      const rest = request === pkgName ? 'lib/index.js' : request.startsWith(pkgName + '/') ? request.slice(pkgName.length + 1) : null;
      if (rest) {
        const args = Array.from(arguments);
        args[0] = path.join(ROOT, rest);
        return origResolve.apply(this, args);
      }
    }
    throw err;
  }
};
