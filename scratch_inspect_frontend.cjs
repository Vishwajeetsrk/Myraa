const fs = require('fs');

const code = fs.readFileSync('C:/Users/Vishwajeet/Videos/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

function findOccurrences(term) {
  let idx = 0;
  console.log('=== SEARCH FOR:', term, '===');
  let count = 0;
  while ((idx = code.indexOf(term, idx)) !== -1) {
    console.log(`[${count}] at ${idx}:`, JSON.stringify(code.substring(Math.max(0, idx - 40), idx + 100)));
    idx += term.length;
    count++;
    if (count > 8) break;
  }
}

findOccurrences('/live');
findOccurrences('WebSocket');
findOccurrences('/api/chat');
findOccurrences('Type a message');
