const fs = require('fs');

const content = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const lines = content.split('\n');
const line858 = lines[857];

const idx = line858.indexOf('myraaSpeak');
console.log('Current line 858 around myraaSpeak:');
console.log(line858.slice(Math.max(0, idx - 150), idx + 250));
