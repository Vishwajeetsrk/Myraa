const fs = require('fs');

const s = fs.readFileSync('resources/app/dist/server.cjs', 'utf8');
const regex = /voiceName\s*:\s*["'][^"']+["']/g;
let m;
while ((m = regex.exec(s)) !== null) {
  console.log(m[0], 'at pos', m.index);
}
