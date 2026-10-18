const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
console.log(s.slice(0, 300));
