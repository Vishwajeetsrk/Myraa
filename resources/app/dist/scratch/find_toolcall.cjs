const fs = require('fs');
const js = fs.readFileSync('C:/Users/Vishwajeet/Music/Myraa/resources/app/dist/server.cjs', 'utf8');

const matches = [];
let idx = 0;
while ((idx = js.indexOf('toolCall', idx)) !== -1) {
  matches.push({ idx, snippet: js.slice(Math.max(0, idx - 50), idx + 200) });
  idx += 8;
}
console.log('Total toolCall matches:', matches.length);
matches.forEach((m, i) => console.log(i, 'at', m.idx, m.snippet));
