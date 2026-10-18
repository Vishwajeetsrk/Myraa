'use strict';
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'resources', 'app', 'dist', 'assets', 'index-qnLjC2CG.js');
const c = fs.readFileSync(file, 'utf8');

const uoIdx = c.indexOf('const Uo=');
console.log('const Uo= at', uoIdx);
if (uoIdx !== -1) {
  console.log(c.slice(uoIdx, uoIdx + 800));
}
