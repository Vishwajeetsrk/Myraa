const fs = require('fs');

const content = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const lines = content.split('\n');
const line49 = lines[48];

const idx = line49.indexOf('playAudioPCMChunk');
console.log('line 49 around playAudioPCMChunk:');
console.log(line49.slice(idx - 60, idx + 450));
