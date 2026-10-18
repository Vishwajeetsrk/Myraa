'use strict';
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'resources', 'app', 'dist', 'assets', 'index-qnLjC2CG.js');
const c = fs.readFileSync(file, 'utf8');

const t2Idx = 307117;
const perfInit = c.indexOf('this.performance=', t2Idx);
console.log(c.slice(perfInit - 50, perfInit + 400));
