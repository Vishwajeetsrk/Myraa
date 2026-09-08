const fs = require('fs');
const s = fs.readFileSync('D:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const idx = s.indexOf('function EA(');
console.log(s.slice(idx + 1200, idx + 3000));
