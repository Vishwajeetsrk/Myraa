const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

console.log(s.slice(518942 - 1200, 518942));
