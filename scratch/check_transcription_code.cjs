const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

const p = s.indexOf('onTranscription:(');
console.log(s.slice(p, p + 500));
