const fs = require('fs');
const s = fs.readFileSync('D:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const idx = s.indexOf('this.micProcessorNode.onaudioprocess');
console.log(s.slice(idx, idx + 800));
