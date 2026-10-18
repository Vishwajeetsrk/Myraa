const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

console.log('Searching for range inputs:');
let idx = 0;
while ((idx = s.indexOf('type:"range"', idx)) !== -1) {
  console.log('--- Range input at', idx, '---');
  console.log(s.slice(Math.max(0, idx - 200), Math.min(s.length, idx + 300)));
  idx += 12;
}

console.log('Searching for sun or brightness icon:');
['Sun', 'sun', 'Brightness', 'brightness', 'luminance', 'dimmer'].forEach(w => {
  let p = 0;
  while ((p = s.indexOf(w, p)) !== -1) {
    console.log('Term:', w, 'at', p, '->', s.slice(Math.max(0, p - 80), Math.min(s.length, p + 120)));
    p += w.length;
    if (p > 500000) break;
  }
});
