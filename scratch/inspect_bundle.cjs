const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

const regex = /"([^"\\]*(?:setting|config|modal|dialog|drawer|key|recal|share)[^"\\]*)"/gi;
let m;
const found = new Set();
while ((m = regex.exec(s)) !== null) {
  if (m[1].length < 50) found.add(m[1]);
}
console.log('Found matches:', Array.from(found).slice(0, 40));
