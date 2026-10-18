'use strict';
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'resources', 'app', 'dist', 'assets', 'index-qnLjC2CG.js');
const c = fs.readFileSync(file, 'utf8');

const setExprIdx = 273284;
console.log(c.slice(setExprIdx - 800, setExprIdx));
