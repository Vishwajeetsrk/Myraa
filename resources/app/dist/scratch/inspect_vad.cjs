const fs = require('fs');
const s = fs.readFileSync('D:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const idx = s.indexOf('updateVoiceActivity(');
console.log('first occurrence:', idx);
const secondIdx = s.indexOf('updateVoiceActivity(', idx + 1);
console.log('second occurrence:', secondIdx);
if (secondIdx !== -1) {
  console.log(s.slice(secondIdx - 50, secondIdx + 400));
}
