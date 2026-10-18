#!/usr/bin/env node
'use strict';

// MYRAA's desktop backend and UI are a curated prebuilt bundle in dist/.
// Running Vite with its default outDir emptied that bundle and produced an app
// without server.cjs. Validate this contract instead of destructively replacing
// the shipped desktop bundle.
const fs = require('fs');
const path = require('path');

const app = path.join(__dirname, '..', 'resources', 'app');
const dist = path.join(app, 'dist');
const required = [
  'index.html',
  'server.cjs',
  'launcher/executable_resolver.cjs',
];

let failures = 0;
for (const relative of required) {
  const file = path.join(dist, relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    console.error(`[FAIL] Required desktop bundle file is missing: dist/${relative}`);
    failures++;
  } else {
    console.log(`[PASS] dist/${relative} (${fs.statSync(file).size} bytes)`);
  }
}

if (failures) {
  console.error('\nMYRAA production bundle is incomplete. Restore or regenerate dist/ before packaging.');
  process.exit(1);
}

console.log('\n[PASS] MYRAA production bundle is intact; no destructive Vite output was written.');
