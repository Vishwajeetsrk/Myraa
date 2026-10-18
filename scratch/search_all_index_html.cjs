'use strict';
const fs = require('fs');
const path = require('path');

function searchHtml(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name !== 'node_modules' && ent.name !== '.git') {
        searchHtml(full);
      }
    } else if (ent.name === 'index.html') {
      const content = fs.readFileSync(full, 'utf8');
      console.log('Found index.html at:', full);
      console.log('Has ui-health-patch?', content.includes('ui-health-patch'));
      console.log('Has universal-control?', content.includes('universal-control'));
      console.log('Content preview:\n', content.slice(0, 400));
    }
  }
}

console.log('--- Desktop Portable ---');
searchHtml(path.join(process.env.USERPROFILE || '', 'Desktop', 'MYRAA-Portable'));

console.log('--- LocalAppData Programs ---');
searchHtml(path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MYRAA'));
