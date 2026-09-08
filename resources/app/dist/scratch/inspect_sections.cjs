const fs = require('fs');
const content = fs.readFileSync('d:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

function showSection(term, len = 2500) {
  console.log(`\n=================== SECTION: ${term} ===================`);
  const idx = content.indexOf(term);
  if (idx !== -1) {
    console.log(content.substring(idx, idx + len));
  } else {
    console.log('Not found');
  }
}

showSection('h==="about"');
showSection('h==="plugins"');
showSection('h==="voice"');
showSection('onTranscription');
