const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

// Find the voice settings panel and voice selector options
const terms = ['voiceName', 'selectedVoice', 'voice_preset', 'voicePreset', 'myraa_voice', 'MYRAA_VOICE'];
terms.forEach(t => {
  let idx = 0;
  while ((idx = s.indexOf(t, idx)) !== -1) {
    console.log('=== ' + t + ' at', idx, '===');
    console.log(s.slice(Math.max(0, idx-100), idx+400));
    idx += t.length;
  }
});

// Also find voice settings panel options
const idx2 = s.indexOf('"voice",label:"VOICE"');
if (idx2 !== -1) {
  console.log('\n=== Voice panel at', idx2, '===');
  console.log(s.slice(idx2, idx2 + 4000));
}
