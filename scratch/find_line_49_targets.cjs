const fs = require('fs');

const content = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const lines = content.split('\n');
const line49 = lines[48];

// Target 1: Constructor injection
const startIdx1 = line49.indexOf(';this.hasAudioInTurn=!1;this.turnModelText="";if(typeof window!=="undefined"&&!window.myraaSpeak)');
console.log('Target 1 index:', startIdx1);
if (startIdx1 !== -1) {
  const endIdx1 = line49.indexOf('}}setState', startIdx1);
  console.log('Target 1 snippet to replace:');
  console.log(line49.slice(startIdx1, endIdx1 + 2));
}

// Target 2: Audio & interrupted injection
const startIdx2 = line49.indexOf('r.type==="audio"&&r.audio');
console.log('Target 2 index:', startIdx2);
if (startIdx2 !== -1) {
  console.log('Target 2 snippet:');
  console.log(line49.slice(startIdx2 - 30, startIdx2 + 250));
}

// Target 3: turnComplete & transcription injection
const startIdx3 = line49.indexOf('if(!this.hasAudioInTurn&&this.turnModelText)');
console.log('Target 3 index:', startIdx3);
if (startIdx3 !== -1) {
  console.log('Target 3 snippet:');
  console.log(line49.slice(startIdx3 - 30, startIdx3 + 350));
}
