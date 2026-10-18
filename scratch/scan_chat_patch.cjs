'use strict';
const fs = require('fs');
const content = fs.readFileSync('resources/app/dist/ui-health-patch.js', 'utf8');

// Search for chat input handling or message sending
const matches = [];
for (const m of content.matchAll(/(?:sendChat|sendMessage|onSend|onSubmit|handleSubmit|handleChat|post.*\/api\/chat|input.*chat|chat.*input|textarea)/gi)) {
  matches.push({ index: m.index, text: m[0] });
}
console.log('Matches found:', matches.length);
for (const m of matches.slice(0, 15)) {
  const start = Math.max(0, m.index - 100);
  const end = Math.min(content.length, m.index + 200);
  console.log('=== MATCH: ' + m.text + ' at ' + m.index + ' ===');
  console.log(content.slice(start, end));
}
