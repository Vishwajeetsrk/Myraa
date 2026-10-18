const fs = require('fs');
const s = fs.readFileSync('resources/app/release/win-unpacked/resources/app.asar.unpacked/dist/ui-health-patch.js', 'utf8');

const regex = /(?:canvas|character|avatar)[^;{}]{0,100}(?:display|opacity|visibility|z-index|pointer-events)[^;{}]{0,100};/gi;
let match;
while ((match = regex.exec(s)) !== null) {
  console.log(match[0]);
}
