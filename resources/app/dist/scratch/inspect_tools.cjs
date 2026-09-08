const fs = require('fs');
const js = fs.readFileSync('C:/Users/Vishwajeet/Music/Myraa/resources/app/dist/server.cjs', 'utf8');
const idx = 270146;
const chunk = js.slice(idx, idx + 60000);

const names = [];
const re = /name:\s*"([^"]+)"/g;
let m;
while ((m = re.exec(chunk)) !== null) {
  names.push(m[1]);
}
console.log('Total tools declared:', names.length);
console.log('Tool names:', names);
