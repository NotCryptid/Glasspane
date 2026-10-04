'use strict';

// Test harness for the runtime, with no WinUI host involved.
//
// The bridge normally reads stdin and writes stdout. A test stands in for the host by capturing
// the protocol writes and feeding messages back in, so the runtime can be exercised on any machine.

const fs = require('node:fs');
const path = require('node:path');

const BRIDGE = path.join(__dirname, '..', 'lib', 'bridge.js');

/**
 * Loads the runtime fresh with a captured protocol. Returns handles for driving the app.
 *
 * @param {(bridge, sent) => void} run  called once the bridge exists, to define the app
 */
function createHost() {
  // Tests stand in for the host, so the runtime must not try to launch a real one (it would on macOS).
  process.env.GLASSPANE_HOSTED = '1';
  const sent = [];
  const realWrite = fs.writeSync;
  const realStdoutWrite = process.stdout.write;

  // Intercept before the runtime loads, so the bridge captures the patched version.
  fs.writeSync = (fd, text) => {
    if (fd === 1 && typeof text === 'string' && text.trimStart().startsWith('{')) {
      const msg = JSON.parse(text);
      sent.push(msg);
      // Stand in for the host: a window is live once it says hello.
      if (msg.type === 'hello') {
        queueMicrotask(() => bridge.receive(JSON.stringify({ type: 'ready', window: msg.window })));
      }
      return text.length;
    }
    return realWrite(fd, text);
  };
  // The bridge replaces process.stdout.write; tests read results through this instead.
  process.stdout.write = () => true;

  const bridge = require(BRIDGE).createBridge();

  const restore = () => {
    fs.writeSync = realWrite;
    process.stdout.write = realStdoutWrite;
  };

  // Arrow functions below have no `this` of their own, so they reach each other through `host`.
  const host = {
    bridge,
    sent,    /** Every render message, in order. */
    renders: () => sent.filter((m) => m.type === 'render'),
    /** The most recent render for a window. */
    last: (w) => sent.filter((m) => m.type === 'render' && m.window === w).at(-1),
    of: (type) => sent.filter((m) => m.type === type),
    /** Delivers a message as if the host had sent it. */
    fromHost: (msg) => bridge.receive(JSON.stringify(msg)),
    /** Finds a button by label and returns its click handler id. */
    button: (w, label) => buttonId(host.last(w) && host.last(w).root, label),
    /** Clicks a button by label, the way the host would on a real click. */
    click: (w, label) => {
      const id = host.button(w, label);
      if (!id) throw new Error(`No button labelled ${JSON.stringify(label)} in window ${w}`);
      host.fromHost({ type: 'event', window: w, id, seq: ++seq });
      return id;
    },
    restore,
  };
  return host;
}

let seq = 0;

/** Handler ids are tree paths, so buttons are found structurally. */
function buttonId(node, label) {
  if (!node) return null;
  if (node.t === 'Button' && node.p && node.p.text === label) return (node.e && node.e.click) || null;
  for (const kid of node.c || []) {
    const hit = buttonId(kid, label);
    if (hit) return hit;
  }
  return null;
}

/** Waits for pending microtasks and timers to settle. */
// A floor of 50 ms keeps the tests steady on a loaded machine, such as a CI runner or a cold start.
const tick = (ms = 5) => new Promise((r) => setTimeout(r, Math.max(ms, 50)));

/**
 * Ends a test case. The bridge keeps stdin resumed so a real app stays alive with no windows, so
 * a test process must leave explicitly once its assertions are done.
 */
function done(host) {
  host.restore();
  process.exit(0);
}

module.exports = { createHost, tick, done };
