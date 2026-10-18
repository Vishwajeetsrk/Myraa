const fs = require('fs');

const content = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const lines = content.split('\n');
const line49 = lines[48];

let pos = 0;
while (true) {
  const i = line49.indexOf('myraaSpeak', pos);
  if (i === -1) break;
  console.log(`myraaSpeak in line 49 at pos ${i}:`);
  console.log(line49.slice(Math.max(0, i - 80), i + 160));
  pos = i + 10;
}
