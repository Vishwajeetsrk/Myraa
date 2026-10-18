const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/server.cjs', 'utf8');

const p = s.indexOf('app.post("/api/chat"');
console.log(s.slice(p + 800, p + 2500));
