const fs = require('fs');
const s = fs.readFileSync('D:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const idx = s.indexOf('cinematic-subtitles');
console.log(s.slice(idx - 50, idx + 800));
