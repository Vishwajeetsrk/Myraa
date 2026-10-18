'use strict';
const fs = require('fs');
const path = require('path');
const dist = 'resources/app/dist';
for (const f of fs.readdirSync(dist)) {
  const p = path.join(dist, f);
  if (fs.statSync(p).isFile() && (f.endsWith('.js') || f.endsWith('.css') || f.endsWith('.html'))) {
    const c = fs.readFileSync(p, 'utf8');
    if (c.includes('brightness') || c.includes('slider')) {
      console.log(f, 'has brightness or slider');
      for (const m of c.matchAll(/brightness/gi)) {
        const start = Math.max(0, m.index - 60);
        const end = Math.min(c.length, m.index + 100);
        console.log('  [' + f + ']:', c.slice(start, end).replace(/\n/g, ' '));
      }
    }
  }
}
