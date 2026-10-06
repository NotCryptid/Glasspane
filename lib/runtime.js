'use strict';

const { setInvalidator, track } = require('./state');
const { View, VStack, Text, Card } = require('./view');
const { serialize } = require('./serialize');
const { createBridge } = require('./bridge');
const { resolveMenu } = require('./menu');

const apps = new Map();
let nextWindowId = 1;
let focused = null;

// stdin carries newline-delimited JSON from the host; stdout carries the same back to it.
const bridge = createBridge();
globalThis.__glasspane = bridge;

// Registered once, at load: messages can arrive before the first App() call, and a second App()
// must not replace the handler.
bridge.onMessage((msg) => {
  try {
    onMessage(msg);
  } catch (e) {
    console.error(e);
  }
});

/** The window new calls act on: the one the user last interacted with, else the newest. */
function active() {
  return focused && apps.has(focused) ? apps.get(focused) : [...apps.values()][0] ?? null;
}

// Registered once. A state change re-renders only the windows that read it during their last
// body() call, which buildTree records. Anything else would re-render every window on every
// keystroke, since window trees are rebuilt wholesale.
setInvalidator((changed) => {
  for (const target of apps.values()) {
    if (target.closed || target.scheduled) continue;
    if (changed && !target.deps.has(changed)) continue;
    target.scheduled = true;
    queueMicrotask(() => { target.scheduled = false; render(target, false); });
  }
});

/**
 * Starts an app. Each call creates its own window.
 *
 *   App('My App', () => VStack(Text('Hello')))
 *   App({ title: 'My App', width: 800, height: 600, backdrop: 'mica', theme: 'dark' }, () => ...)
 *
 * `body` runs again whenever a `state` changes or an event handler finishes, and returns the
 * whole UI. The host keeps the native controls and only updates what changed.
 *
 * Returns a window handle you can pass to `system.windowOf(win)` or close with `win.close()`.
 */
function App(config, body) {
  if (!bridge.isHost) {
    throw new Error('Not running inside the Glasspane host. Start the app with `glasspane app.js` or `node app.js`.');
  }
  if (typeof config === 'string') config = { title: config };
  if (typeof body !== 'function') {
    const view = body;
    body = () => view;
  }

  const app = {
    id: nextWindowId++,
    bridge,
    window: { title: 'Glasspane', width: 900, height: 640, backdrop: 'mica', theme: 'system', ...config },
    handlers: new Map(),
    requests: new Map(),
    nextRequest: 1,
    processed: 0,
    lastSent: '',
    scheduled: false,
    ready: false,
    queued: [],
    closed: false,
    deps: new Set(),
    body,
  };
  apps.set(app.id, app);
  focused = app.id;

  send(app, { type: 'hello', window: app.id });
  return api(app);
}

function send(app, msg) {
  // The window id goes on every message so the host can route it to the right native window.
  bridge.emit({ window: app.id, ...msg });
}

/** The fallback tree shown when rendering fails. Deliberately plain, so it cannot itself fail. */
function errorView(err) {
  const detail = String((err && err.stack) || err);
  return VStack(
    Text('Error while rendering').font('title3').foreground('danger'),
    Card(Text(detail).selectable().font({ family: 'Cascadia Mono', size: 12 })),
  ).alignment('leading').padding(24);
}

function buildTree(app) {
  const read = track();
  let view;
  try {
    view = app.body();
  } catch (err) {
    console.error(err);
    view = errorView(err);
  }
  // The menu may read state too, so it is built while reads are still being recorded.
  let menu;
  try {
    menu = app.window.menu;
    if (typeof menu === 'function') menu = menu();
  } catch (err) {
    console.error(err);
    menu = undefined;
  }
  // Replace rather than merge: a state this window no longer reads must stop waking it up.
  app.deps = read;
  app.handlers = new Map();
  let n = 0;
  try {
    app.menu = resolveMenu(menu, (fn) => {
      const id = `w${app.id}:menu${n++}`;
      app.handlers.set(id, fn);
      return id;
    });
  } catch (err) {
    console.error(err);
    app.menu = undefined;
  }
  return serialize(view instanceof View ? view : Text(view), app.handlers, `w${app.id}`);
}

function render(app, force) {
  if (!app.ready || app.closed) return;
  let json;
  try {
    const root = buildTree(app);
    const msg = { type: 'render', window: app.id, ack: app.processed, config: windowForHost(app.window, app.menu), root };
    json = JSON.stringify(msg);
  } catch (err) {
    // body() is guarded in buildTree, but serialize() and JSON.stringify can still throw: a circular
    // prop, a getter that throws, or a BigInt. Those must not blank the window, so serialize the
    // fallback on its own and send that. errorView holds only strings, so this path cannot rethrow.
    console.error(err);
    app.handlers = new Map();
    const root = serialize(errorView(err), app.handlers, `w${app.id}`);
    json = JSON.stringify({ type: 'render', window: app.id, ack: app.processed, config: windowForHost(app.window, undefined), root });
  }
  if (!force && json === app.lastSent) return;
  app.lastSent = json;
  bridge.emit(json);
}

function close(app) {
  if (!app || app.closed) return;
  app.closed = true;
  apps.delete(app.id);
  if (focused === app.id) focused = [...apps.keys()].pop() ?? null;
  send(app, { type: 'close', window: app.id });
}

function onMessage(msg) {
  const app = msg.window != null ? apps.get(msg.window) : null;
  if (msg.type === 'focus') { focused = msg.window; return; }
  if (msg.type === 'closed') {
    if (app) { app.closed = true; apps.delete(app.id); }
    if (focused === (app && app.id)) focused = [...apps.keys()].pop() ?? null;
    // The process stays alive until the last window closes, like any other desktop app.
    if (!apps.size) process.exit(0);
    return;
  }
  if (!app) return;
  switch (msg.type) {
    case 'ready':
      app.ready = true;
      focused = app.id;
      render(app, true);
      for (const m of app.queued.splice(0)) send(app, m);
      break;
    case 'event': {
      app.processed = msg.seq;
      const handler = app.handlers.get(msg.id);
      if (handler) {
        try {
          const r = handler(msg.value);
          if (r && typeof r.then === 'function') r.catch((e) => console.error(e)).finally(() => render(app, false));
        } catch (e) {
          console.error(e);
        }
      }
      // Always re-render after an event, even if no state changed, so the host's ack catches up
      // and a rejected input value is pushed back into the control.
      if (!app.scheduled) {
        app.scheduled = true;
        queueMicrotask(() => { app.scheduled = false; render(app, true); });
      }
      break;
    }
    case 'response': {
      const pending = app.requests.get(msg.id);
      if (!pending) break;
      app.requests.delete(msg.id);
      if (msg.error) pending.reject(new Error(msg.error)); else pending.resolve(msg.result);
      break;
    }
    case 'error':
      console.error('[glasspane]', msg.message);
      break;
  }
}

/** Calls into Windows (dialogs, pickers, clipboard...) and resolves with the answer. */
function request(method, args = {}, target = active()) {
  if (!target) return Promise.reject(new Error('Call App() first.'));
  const app = target;
  const id = app.nextRequest++;
  return new Promise((resolve, reject) => {
    app.requests.set(id, { resolve, reject });
    const msg = { type: 'request', window: app.id, id, method, args };
    if (app.ready) send(app, msg); else app.queued.push(msg);
  });
}

// Relative icon paths are resolved against the main script's folder.
function windowForHost(w, menu) {
  // `menu` in the options is the app's description; the host gets the resolved JSON instead.
  w = { ...w, menu };
  if (!w.icon) return w;
  const base = process.argv[1] ? require('node:path').dirname(process.argv[1]) : process.cwd();
  try {
    return { ...w, icon: require('./icon').resolveIcon(require('node:path').resolve(base, w.icon)) };
  } catch (e) {
    console.error('[glasspane] ' + e.message);
    return { ...w, icon: undefined };
  }
}

/** The public handle `App()` returns: per-window settings, dialogs and close. */
function api(app) {
  // Required lazily: system.js pulls in runtime.js, so importing it here would be a cycle.
  const { forWindow } = require('./system');
  const win = {
    id: app.id,
    window: proxy(app),
    request: (method, args) => request(method, args, app),
    close: () => close(app),
  };
  return { ...win, ...forWindow(win) };
}

function proxy(app) {
  return new Proxy({}, {
    get: (_, k) => app.window[k],
    set: (_, k, v) => {
      app.window[k] = v;
      setImmediate(() => render(app, false));
      return true;
    },
  });
}

/** A proxy so `system.window.title = 'x'` updates the focused window. */
const appWindow = new Proxy({}, {
  get: (_, k) => {
    const app = active();
    return app && app.window[k];
  },
  set: (_, k, v) => {
    const app = active();
    if (!app) throw new Error('Call App() first.');
    app.window[k] = v;
    setImmediate(() => render(app, false));
    return true;
  },
});

function quit() {
  for (const app of [...apps.values()]) send(app, { type: 'quit' });
  if (!apps.size) process.exit(0);
}

module.exports = { App, request, appWindow, quit, windowOf: (win) => win };
