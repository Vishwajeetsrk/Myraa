const fs = require('fs');

const code = fs.readFileSync('c:/Users/Vishwajeet/Music/Myraa/resources/app/dist/server.cjs', 'utf8');
const idx = code.lastIndexOf('catch', 402800);
console.log('catch at', idx);
console.log(code.substring(idx, idx + 800));
