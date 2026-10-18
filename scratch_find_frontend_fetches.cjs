'use strict';
const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, 'resources', 'app', 'dist', 'assets', 'index-qnLjC2CG.js');
const content = fs.readFileSync(jsPath, 'utf8');

// Find all fetch() usages and their surrounding context
let idx = 0;
while ((idx = content.indexOf('fetch(', idx)) !== -1) {
  const snippet = content.slice(Math.max(0, idx - 50), Math.min(content.length, idx + 150));
  console.log('--- FETCH SNIPPET ---');
  console.log(snippet);
  idx += 6;
}
