const fs = require('fs');

const bundlePath = 'resources/app/dist/assets/index-qnLjC2CG.js';
const content = fs.readFileSync(bundlePath, 'utf8');

let pos = 0;
const occurrences = [];
while (true) {
  const idx = content.indexOf('myraaSpeak', pos);
  if (idx === -1) break;
  occurrences.push(idx);
  pos = idx + 'myraaSpeak'.length;
}

console.log('Occurrences count:', occurrences.length);
occurrences.forEach((idx, i) => {
  console.log(`\n--- Occurrence #${i+1} at index ${idx} ---`);
  console.log(content.slice(Math.max(0, idx - 100), idx + 150));
});
