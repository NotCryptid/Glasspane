'use strict';

const { request, quit, appWindow } = require('./runtime');

/** Windows features exposed as plain promises. */
const system = {
  /** Message box. Resolves with the index of the button pressed. */
  alert: (message, { title = '', buttons = ['OK'] } = {}) => request('alert', { title, message, buttons }),

  /** OK/Cancel question. Resolves true for OK. */
  confirm: async (message, { title = '', ok = 'OK', cancel = 'Cancel' } = {}) =>
    (await request('alert', { title, message, buttons: [ok, cancel] })) === 0,

  /** File picker. Resolves with a path (or an array when `multiple`), or null if cancelled. */
  openFile: ({ extensions = ['*'], multiple = false } = {}) => request('openFile', { extensions, multiple }),

  /** Save picker. Resolves with the chosen path or null. */
  saveFile: ({ name, extensions = ['.txt'], description = 'Files' } = {}) =>
    request('saveFile', { name, extensions, description }),

  pickFolder: () => request('pickFolder'),

  clipboard: {
    read: () => request('clipboardRead'),
    write: (text) => request('clipboardWrite', { text }),
  },

  /** Opens a URL or protocol (https://, mailto:, ms-settings:) in the default handler. */
  launch: (uri) => request('launch', { uri }),

  quit,
  window: appWindow,
};

module.exports = { system };
