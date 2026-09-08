const fs = require('fs');
const s = fs.readFileSync('D:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const idx = s.indexOf('audio:{echoCancellation:!0');
console.log(s.slice(idx - 300, idx + 400));
