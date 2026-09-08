const fs = require('fs');

const js = fs.readFileSync('C:/Users/Vishwajeet/Music/Myraa/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const returnIdx = 512997;
const footerIdx = returnIdx + 9450;
console.log(js.slice(footerIdx, footerIdx + 3000));
