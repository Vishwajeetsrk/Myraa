'use strict';
const fs = require('fs');
const path = require('path');

function search(dir, depth = 0) {
  if (depth > 4) return;
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f === 'node_modules' || f === '.git' || f === 'cache') continue;
      const p = path.join(dir, f);
      try {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          search(p, depth + 1);
        } else if (f.endsWith('.js') || f.endsWith('.cjs') || f.endsWith('.html') || f.endsWith('.json')) {
          const content = fs.readFileSync(p, 'utf8');
          if (content.includes('universal-control-addon.js') || content.includes('ui-health-patch.js')) {
            console.log('Match in:', p);
            for (const line of content.split('\n')) {
              if (line.includes('universal-control-addon.js') || line.includes('ui-health-patch.js')) {
                console.log('  ->', line.trim().slice(0, 150));
              }
            }
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
}

console.log('=== Searching AppData Programs ===');
search('C:\\Users\\Vishwajeet\\AppData\\Local\\Programs\\MYRAA');

console.log('=== Searching Desktop Portable ===');
search('C:\\Users\\Vishwajeet\\Desktop\\MYRAA-Portable');
