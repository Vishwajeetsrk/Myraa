const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/server.cjs', 'utf8');

let p = 0;
while ((p = s.indexOf('clientWs.on', p)) !== -1) {
  console.log('clientWs.on at:', p);
  console.log(s.slice(p, p + 800));
  p += 11;
}
