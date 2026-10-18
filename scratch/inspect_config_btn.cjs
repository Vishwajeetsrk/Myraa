const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

const idx = s.indexOf('Myraa Configuration');
// Let's find the component name or usage
console.log('Context before Myraa Configuration:');
console.log(s.slice(Math.max(0, idx - 1500), idx));
