const fs = require('fs');

const content = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const lines = content.split('\n');
const line49 = lines[48];

const idx = line49.indexOf('r.type==="transcription"');
console.log('line 49 around transcription:');
console.log(line49.slice(idx - 20, idx + 200));
