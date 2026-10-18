const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/desktopAutomation.cjs', 'utf8');

const p = s.indexOf('volumeUp');
console.log(s.slice(p, p + 1200));
