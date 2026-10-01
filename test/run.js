'use strict';

// Runtime tests. Run with `npm test`.
//
// These cover the parts that no compiler checks: message routing between windows, the render
// fallback, dependency-scoped re-rendering, and keeping stdout clean for the protocol.

const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const only = process.argv[2];

async function test(name, fn) {
  if (only && !name.includes(only)) return;
  // Each test runs in its own process, because the runtime and bridge are module-level singletons.
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'cases', slug(name) + '.js')], {
      stdio: 'inherit',
      timeout: 30000,
    });    console.log('  ok   ' + name);
    passed++;
  } catch (e) {
    console.log('  FAIL ' + name);
    failed++;
  }
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

(async () => {
  console.log('glasspane runtime tests\n');
  await test('two windows render independently');
  await test('handler ids are namespaced per window');
  await test('events route to the window that raised them');
  await test('shared state updates every dependent window');
  await test('a state only re-renders windows that read it');
  await test('a state a window stops reading stops waking it');
  await test('closing one window leaves the others running');
  await test('per-window dialogs are routed to their window');
  await test('a render error shows the stack instead of blanking');
  await test('a circular prop does not blank the window');
  await test('stdout stays clean when user code writes to it');
  await test('the process exits when the last window closes');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
