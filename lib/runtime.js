'use strict';

const { setInvalidator } = require('./state');
const { View, VStack, Text, Card } = require('./view');
const { serialize } = require('./serialize');

let current = null;

/**
 * Starts an app.
 *
 *   App('My App', () => VStack(Text('Hello')))
 *   App({ title: 'My App', width: 800, height: 600, backdrop: 'mica', theme: 'dark' }, () => ...)
 *
 * `body` runs again whenever a `state` changes or an event handler finishes, and returns the
 * whole UI. The host keeps the native controls and only updates what changed.
 */
function App(config, body) {
  const bridge = globalThis.__glasspane;
  if (!bridge) {
    throw new Error('Not running inside the Glasspane host. Start the app with `glasspane app.js` or `node app.js`.');
  }
  if (current) throw new Error('App() was already called; one app per process.');
  if (typeof config === 'string') config = { title: config };
  if (typeof body !== 'function') {
    const view = body;
    body = () => view;
  }

  const app = {
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
    body,
  };
  current = app;

  setInvalidator(() => {
    if (app.scheduled) return;
    app.scheduled = true;
    queueMicrotask(() => { app.scheduled = false; render(app, false); });
  });

  bridge.receive = (line) => {
    try {
      onMessage(app, JSON.parse(line));
    } catch (e) {
      console.error(e);
    }
  };
  send(app, { type: 'hello' });
  return app;
}

function send(app, msg) {
  app.bridge.send(JSON.stringify(msg));
}

function buildTree(app) {
  let view;
  try {
    view = app.body();
  } catch (err) {
    console.error(err);
    view = VStack(
      Text('Error while rendering').font('title3').foreground('danger'),
      Card(Text(String((err && err.stack) || err)).selectable().font({ family: 'Cascadia Mono', size: 12 })),
    ).alignment('leading').padding(24);
  }
  app.handlers = new Map();
  return serialize(view instanceof View ? view : Text(view), app.handlers);
}

function render(app, force) {
  if (!app.ready) return;
  const json = JSON.stringify({ type: 'render', ack: app.processed, window: windowForHost(app.window), root: buildTree(app) });
  if (!force && json === app.lastSent) return;
  app.lastSent = json;
  app.bridge.send(json);
}

function onMessage(app, msg) {
  switch (msg.type) {
    case 'ready':
      app.ready = true;
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
    case 'closed':
      process.exit(0);
  }
}

/** Calls into Windows (dialogs, pickers, clipboard...) and resolves with the answer. */
function request(method, args = {}) {
  if (!current) return Promise.reject(new Error('Call App() first.'));
  const app = current;
  const id = app.nextRequest++;
  return new Promise((resolve, reject) => {
    app.requests.set(id, { resolve, reject });
    const msg = { type: 'request', id, method, args };
    if (app.ready) send(app, msg); else app.queued.push(msg);
  });
}

// Relative icon paths are resolved against the main script's folder.
function windowForHost(w) {
  if (!w.icon) return w;
  const base = process.argv[1] ? require('node:path').dirname(process.argv[1]) : process.cwd();
  return { ...w, icon: require('node:path').resolve(base, w.icon) };
}

// A proxy so `appWindow.title = 'x'` updates the native window.
const appWindow = new Proxy({}, {
  get: (_, k) => current && current.window[k],
  set: (_, k, v) => {
    if (!current) throw new Error('Call App() first.');
    current.window[k] = v;
    setImmediate(() => render(current, false));
    return true;
  },
});

function quit() {
  if (current) send(current, { type: 'quit' }); else process.exit(0);
}

module.exports = { App, request, appWindow, quit };
