const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/server.cjs', 'utf8');

let p = 0;
let count = 0;
while ((p = s.indexOf('app.post("/api/', p)) !== -1 && count < 10) {
  console.log('Route at', p, s.slice(p, p + 80));
  p += 15;
  count++;
}
