const fs = require('fs');
const content = fs.readFileSync('d:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

const idx = content.indexOf('h==="about"');
if (idx !== -1) {
  console.log('--- FOUND h==="about" ---');
  console.log(content.substring(idx, idx + 1500));
}
