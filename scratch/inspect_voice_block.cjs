const fs = require('fs');

const bundlePath = 'resources/app/dist/assets/index-qnLjC2CG.js';
const content = fs.readFileSync(bundlePath, 'utf8');

const startIdx = content.indexOf('if(typeof window!=="undefined"&&!window.myraaSpeak)');
console.log('startIdx:', startIdx);
if (startIdx === -1) {
  const altIdx = content.indexOf('!window.myraaSpeak');
  console.log('altIdx:', altIdx);
  if (altIdx !== -1) {
    console.log(content.slice(altIdx - 80, altIdx + 1500));
  }
} else {
  console.log(content.slice(startIdx - 80, startIdx + 2000));
}
