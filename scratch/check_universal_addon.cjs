const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/universal-control-addon.js', 'utf8');

const terms = ['sidebar', 'nav', 'root', 'canvas', 'character', 'avatar', 'model'];
terms.forEach(t => {
  let idx = 0;
  let count = 0;
  while ((idx = s.indexOf(t, idx)) !== -1) {
    count++;
    if (count <= 3) {
      console.log('Match', t, 'at', idx, ':', s.slice(Math.max(0, idx - 40), Math.min(s.length, idx + 100)));
    }
    idx += t.length;
  }
  console.log('Total', t, ':', count);
});
