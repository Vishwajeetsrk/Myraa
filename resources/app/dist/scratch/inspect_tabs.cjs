const fs = require('fs');
const content = fs.readFileSync('d:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

const pIdx = content.indexOf('h==="plugins"');
if (pIdx !== -1) {
  console.log('--- PLUGINS TAB COMPONENT ---');
  console.log(content.substring(pIdx - 100, pIdx + 3000));
} else {
  console.log('Not found');
}
