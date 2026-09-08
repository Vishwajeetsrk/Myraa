const fs = require('fs');
const s = fs.readFileSync('D:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const matches = [...s.matchAll(/(AudioContext)/g)];
for (const m of matches) {
  console.log(s.slice(Math.max(0, m.index - 50), Math.min(s.length, m.index + 120)));
}
