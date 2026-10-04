'use strict';

const { request, quit, appWindow } = require('./runtime');

const PLATFORM = process.platform === 'darwin' ? 'macos' : 'windows';

/** The subset of `system` that is scoped to one window. `App()` returns this for its own window. */
function forWindow(win) {
  return {
    ...system,
    window: win.window,
    alert: (message, opts) => win.request('alert', { title: '', message, buttons: ['OK'], ...opts }),
    confirm: async (message, { title = '', ok = 'OK', cancel = 'Cancel' } = {}) =>
      (await win.request('alert', { title, message, buttons: [ok, cancel] })) === 0,
    openFile: ({ extensions = ['*'], multiple = false } = {}) => win.request('openFile', { extensions, multiple }),
    saveFile: ({ name, extensions = ['.txt'], description = 'Files' } = {}) =>
      win.request('saveFile', { name, extensions, description }),
    pickFolder: () => win.request('pickFolder'),
    clipboard: {
      read: () => win.request('clipboardRead'),
      write: (text) => win.request('clipboardWrite', { text }),
    },
    quit: win.close,
  };
}

/** Windows features exposed as plain promises. Each call applies to the focused window. */
const system = {
  /** `'windows'` or `'macos'`. */
  platform: PLATFORM,

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

  /** The `system` API bound to one window, as returned by `App()`. */
  windowOf: (win) => forWindow(win),
};

module.exports = { system, forWindow };
