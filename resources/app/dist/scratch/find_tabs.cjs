const fs = require('fs');
const content = fs.readFileSync('d:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

const regex = /{id:"([^"]+)",label:"([^"]+)"/g;
let m;
while ((m = regex.exec(content)) !== null) {
  console.log('Tab:', m[1], 'Label:', m[2]);
}

// Also find any other navigation/tabs
const navRegex = /label:\s*"([^"]+)"/g;
let n;
const labels = new Set();
while ((n = navRegex.exec(content)) !== null) {
  labels.add(n[1]);
}
console.log('\nAll labels found:', Array.from(labels));
