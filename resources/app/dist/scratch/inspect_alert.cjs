const fs = require('fs');
const s = fs.readFileSync('D:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const idx = s.indexOf('Microphone capture active');
if (idx !== -1) {
  console.log(s.slice(idx - 100, idx + 200));
} else {
  console.log('Not found');
}
