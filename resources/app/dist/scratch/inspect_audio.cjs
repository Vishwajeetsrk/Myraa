const fs = require('fs');
const s = fs.readFileSync('D:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

const matches = [...s.matchAll(/(getUserMedia|voiceThreshold|bargeIn|micDeviceId)/gi)];
for (const m of matches) {
  console.log(m[0], '-->', s.slice(Math.max(0, m.index - 50), Math.min(s.length, m.index + 100)));
}
