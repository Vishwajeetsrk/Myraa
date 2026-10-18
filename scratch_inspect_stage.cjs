const fs = require('fs');

const code = fs.readFileSync('C:/Users/Vishwajeet/Videos/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

// Find stage initialization
let idx = 0;
while ((idx = code.indexOf('.stage', idx)) !== -1) {
  console.log('--- .stage at', idx, '---');
  console.log(code.substring(Math.max(0, idx - 80), Math.min(code.length, idx + 200)));
  idx += 6;
}
