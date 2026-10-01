'use strict';

const fs = require('node:fs');
const util = require('node:util');

// The host and Node exchange newline-delimited JSON over stdin/stdout.
//
// stdout is the protocol channel, so it is reserved: a stray console.log or a dependency printing
// to fd 1 would inject garbage into the message stream. Console output is therefore routed to
// stderr, which the host forwards to the terminal, and the buffered stream on stdout is closed off
// to user code. The protocol itself writes with fs.writeSync, which cannot be intercepted.
//
// Messages go out in a single writeSync call. That is atomic for realistic line sizes, so messages
// cannot interleave even when several are emitted during one event handler.

let handler = () => {};

function createBridge() {
  // Synchronous, so output interleaves correctly with the host's forwarding and is never lost when
  // the app exits.
  const toStderr = (...args) => {
    try { fs.writeSync(2, util.format(...args) + '\n'); } catch { }
  };
  for (const name of ['log', 'info', 'debug', 'warn', 'error', 'trace', 'dir']) console[name] = toStderr;
  console.group = console.groupCollapsed = console.groupEnd = toStderr;
  console.table = (v) => toStderr(util.inspect(v));
  console.time = console.timeEnd = () => { };
  console.count = toStderr;
  console.assert = (cond, ...msg) => { if (!cond) toStderr('Assertion failed:', ...msg); };

  // Block the stream API on stdout. A direct fs.writeSync(1, ...) is deliberately left working: it
  // is how the protocol itself writes, and intercepting that would need a native shim.
  const blocked = () => {
    toStderr('[glasspane] stdout is reserved for the host protocol; that write was ignored. ' +
      'Use console.log, which goes to stderr.');
  };
  process.stdout.write = blocked;
  process.stdout.end = blocked;
  process.stdout.destroy = blocked;

  const write = (text) => {
    try { fs.writeSync(1, text + '\n'); }
    catch (e) { toStderr('[glasspane] protocol write failed: ' + e.message); }
  };

  /** Accepts a message object, or a string that is already valid JSON. */
  const emit = (msg) => {
    if (typeof msg === 'string') return write(msg);
    let json;
    try { json = JSON.stringify(msg); }
    catch (e) { toStderr('[glasspane] could not serialize message: ' + e.message); return; }
    write(json);
  };

  // A message can arrive split across chunks, so hold the tail until its newline shows up.
  let pending = '';
  const deliver = (line) => {
    pending += line;
    let i;
    while ((i = pending.indexOf('\n')) >= 0) {
      const text = pending.slice(0, i).trim();
      pending = pending.slice(i + 1);
      if (!text) continue;
      let msg;
      try { msg = JSON.parse(text); }
      catch (e) { toStderr('[glasspane] bad message from host: ' + e.message); continue; }
      try { handler(msg); } catch (e) { toStderr(String((e && e.stack) || e)); }
    }
  };

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', deliver);
  // The host exiting ends the session; without a window the app would otherwise linger.
  process.stdin.on('end', () => process.exit(0));
  process.stdin.on('close', () => process.exit(0));
  process.stdin.resume();

  return {
    emit,
    isHost: true,
    onMessage: (fn) => { handler = fn; },
    /** Feeds a line in directly, for tests that stand in for the host. */
    receive: (line) => deliver(line + '\n'),
  };
}

module.exports = { createBridge };