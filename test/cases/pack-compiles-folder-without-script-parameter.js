'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findEntry } = require('../../lib/pack.js');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-pack-test-'));

try {
  // Test 1: Directory with package.json "main"
  const dir1 = path.join(tmpDir, 'proj1');
  fs.mkdirSync(dir1);
  fs.writeFileSync(path.join(dir1, 'package.json'), JSON.stringify({ name: 'proj1', main: 'custom-entry.js' }));
  fs.writeFileSync(path.join(dir1, 'custom-entry.js'), '// entry');
  assert.strictEqual(findEntry(dir1), path.join(dir1, 'custom-entry.js'));

  // Test 2: Directory with standard app.js without package.json
  const dir2 = path.join(tmpDir, 'proj2');
  fs.mkdirSync(dir2);
  fs.writeFileSync(path.join(dir2, 'app.js'), '// app entry');
  assert.strictEqual(findEntry(dir2), path.join(dir2, 'app.js'));

  // Test 3: Directory with a single js file
  const dir3 = path.join(tmpDir, 'proj3');
  fs.mkdirSync(dir3);
  fs.writeFileSync(path.join(dir3, 'my-screen.js'), '// screen');
  assert.strictEqual(findEntry(dir3), path.join(dir3, 'my-screen.js'));

  // Test 4: a missing target throws instead of falling back to the current folder
  assert.throws(() => findEntry(path.join(tmpDir, 'missing.js')), /Script not found/);

  // Test 5: a package.json main that does not exist is reported
  const dir5 = path.join(tmpDir, 'proj5');
  fs.mkdirSync(dir5);
  fs.writeFileSync(path.join(dir5, 'package.json'), JSON.stringify({ main: 'gone.js' }));
  fs.writeFileSync(path.join(dir5, 'app.js'), '// app');
  assert.throws(() => findEntry(dir5), /does not exist/);

  // Test 6: several js files and no known entry name is ambiguous
  const dir6 = path.join(tmpDir, 'proj6');
  fs.mkdirSync(dir6);
  fs.writeFileSync(path.join(dir6, 'a.js'), '//');
  fs.writeFileSync(path.join(dir6, 'b.js'), '//');
  assert.throws(() => findEntry(dir6), /Could not find an entry script/);

  // Test 7: config files are not picked as the sole entry
  const dir7 = path.join(tmpDir, 'proj7');
  fs.mkdirSync(dir7);
  fs.writeFileSync(path.join(dir7, 'eslint.config.js'), '//');
  assert.throws(() => findEntry(dir7), /Could not find an entry script/);

  // Test 8: no target uses INIT_CWD
  const saved = process.env.INIT_CWD;
  process.env.INIT_CWD = dir2;
  try { assert.strictEqual(findEntry(), path.join(dir2, 'app.js')); }
  finally { if (saved === undefined) delete process.env.INIT_CWD; else process.env.INIT_CWD = saved; }

  console.log('folder entry resolved without script parameter');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
