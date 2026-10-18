const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/server.cjs', 'utf8');

const p = s.indexOf('app.post("/api/chat"');
if (p !== -1) {
  console.log('Chat route at', p);
  console.log(s.slice(p, p + 1000));
} else {
  console.log('Not found');
}
