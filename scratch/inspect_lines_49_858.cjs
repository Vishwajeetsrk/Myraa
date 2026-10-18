const fs = require('fs');

const content = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const lines = content.split('\n');

const line49 = lines[48]; // 0-indexed
const line858 = lines[857]; // 0-indexed

console.log('--- Line 49 occurrence 1 & 2 ---');
const idx1 = line49.indexOf('myraaSpeak');
console.log(line49.slice(idx1 - 100, idx1 + 750));

console.log('--- Line 49 occurrence 3 & 4 ---');
const idx2 = line49.indexOf('myraaSpeak', idx1 + 20);
const idx3 = line49.indexOf('myraaSpeak', idx2 + 20);
console.log(line49.slice(idx3 - 100, idx3 + 300));

console.log('--- Line 858 occurrence 5 & 6 ---');
const idx4 = line858.indexOf('myraaSpeak');
console.log(line858.slice(idx4 - 100, idx4 + 200));
