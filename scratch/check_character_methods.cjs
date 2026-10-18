'use strict';
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'resources', 'app', 'dist', 'assets', 'index-qnLjC2CG.js');
const c = fs.readFileSync(file, 'utf8');

// Inspect setExpression
const setExprIdx = c.indexOf('setExpression(');
console.log('setExpression at', setExprIdx);
if (setExprIdx !== -1) {
  console.log('--- setExpression ---');
  console.log(c.slice(setExprIdx - 50, setExprIdx + 800));
}

// Inspect performance.update or behaviours.update
// Let's find class for d (performance) and v (behaviours)
const perfIdx = c.indexOf('this.performance=');
console.log('this.performance at', perfIdx);
if (perfIdx !== -1) {
  console.log(c.slice(perfIdx - 50, perfIdx + 500));
}
