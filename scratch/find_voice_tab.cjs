const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

// Find the VOICE settings tab content specifically
const voiceTabIdx = s.indexOf('h==="voice"');
console.log('voice tab content at:', voiceTabIdx);
if (voiceTabIdx !== -1) {
  console.log(s.slice(voiceTabIdx, voiceTabIdx + 5000));
}
