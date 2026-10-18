const fs = require('fs');

const code = fs.readFileSync('c:/Users/Vishwajeet/Music/Myraa/resources/app/dist/server.cjs', 'utf8');
let idx = 0;
while ((idx = code.indexOf('"connected"', idx)) !== -1) {
  console.log('--- "connected" at', idx, '---');
  console.log(code.substring(Math.max(0, idx - 150), Math.min(code.length, idx + 300)));
  idx += 11;
}
