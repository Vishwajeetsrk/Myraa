const fs = require('fs');

const content = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);

lines.forEach((line, idx) => {
  if (line.includes('myraaSpeak')) {
    console.log(`Line ${idx + 1}: length=${line.length}, snippet=${line.slice(line.indexOf('myraaSpeak') - 40, line.indexOf('myraaSpeak') + 80)}`);
  }
});
