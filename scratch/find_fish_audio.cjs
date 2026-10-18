const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

// Find Fish Audio API calls
const terms = ['fish.audio', 'fishaudio', 'fish_audio', '/api/voice', 'fish-audio', 'sk-fish', 'Fish Audio'];
terms.forEach(t => {
  let idx = 0;
  while ((idx = s.indexOf(t, idx)) !== -1) {
    console.log('=== ' + t + ' at', idx, '===');
    console.log(s.slice(Math.max(0, idx - 100), idx + 400));
    idx += t.length;
  }
});
