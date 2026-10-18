const fs = require('fs');
const s = fs.readFileSync('resources/app/release/win-unpacked/resources/app.asar.unpacked/dist/ui-health-patch.js', 'utf8');

console.log('ui-health-patch.js length:', s.length);

// search for character or avatar creation/injection
['Avatar', 'avatar', 'character', 'girl', 'model', 'evelyn', 'talking.mp4', 'idle.mp4', 'thinking.mp4'].forEach(term => {
  let idx = 0;
  let count = 0;
  while ((idx = s.indexOf(term, idx)) !== -1) {
    count++;
    if (count <= 4) {
      console.log(`[${term}] at ${idx}:`, s.slice(Math.max(0, idx - 80), Math.min(s.length, idx + 120)));
    }
    idx += term.length;
  }
  console.log(`Total [${term}]:`, count);
});
