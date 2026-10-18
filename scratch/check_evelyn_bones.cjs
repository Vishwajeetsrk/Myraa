'use strict';
const fs = require('fs');
const c = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const idx = c.indexOf('displayName:"Evelyn"');
console.log(c.slice(idx - 20, idx + 2500));
