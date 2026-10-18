const fs = require('fs');

const code = fs.readFileSync('C:/Users/Vishwajeet/Videos/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const start = 313600;
const len = 3000;
console.log(code.substring(start, start + len));
