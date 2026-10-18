'use strict';
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'resources', 'app', 'dist', 'assets', 'index-qnLjC2CG.js');
const c = fs.readFileSync(file, 'utf8');

const target = '"thinking"';
let idx = 0;
let count = 0;
while ((idx = c.indexOf(target, idx)) !== -1) {
  console.log(`[${count}] at ${idx}:`, c.slice(Math.max(0, idx - 60), idx + 140));
  idx += target.length;
  count++;
}
