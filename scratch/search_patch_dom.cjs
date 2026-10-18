const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/ui-health-patch.js', 'utf8');

console.log('ui-health-patch length:', s.length);
['LEARN', 'slider', 'brightness', 'sidebar', 'hologram', 'avatar', 'canvas', 'character'].forEach(term => {
  let idx = 0;
  let count = 0;
  while ((idx = s.indexOf(term, idx)) !== -1) {
    count++;
    if (count <= 3) {
      console.log(`[${term}] at ${idx}:`, s.slice(Math.max(0, idx - 50), Math.min(s.length, idx + 100)));
    }
    idx += term.length;
  }
  console.log(`Total [${term}]:`, count);
});
