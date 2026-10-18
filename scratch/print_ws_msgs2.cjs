const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/server.cjs', 'utf8');

console.log(s.slice(397500, 401500));
