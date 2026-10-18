'use strict';
const fs = require('fs');
const c = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

// Trace sendText
const idx = c.indexOf('sendText(i){');
console.log('--- sendText definition ---');
console.log(c.slice(idx, idx + 1500));

// Trace form submit: ea = async it => { ... }
const eaIdx = c.indexOf('ea=async it=>{');
console.log('--- form onSubmit ea ---');
console.log(c.slice(eaIdx, eaIdx + 800));
