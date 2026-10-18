const fs = require('fs');
const filePath = 'resources/app/dist/ui-health-patch.js';
const content = fs.readFileSync(filePath, 'utf8');

console.log('Has COMPOSER_MODES:', content.includes('COMPOSER_MODES'));
console.log('Has observerDebounceTimer:', content.includes('observerDebounceTimer'));

const idx1 = content.indexOf('COMPOSER_MODES');
console.log('Around COMPOSER_MODES:', JSON.stringify(content.slice(idx1 - 50, idx1 + 100)));

const idx2 = content.indexOf('observerDebounceTimer');
console.log('Around observerDebounceTimer:', JSON.stringify(content.slice(idx2 - 50, idx2 + 100)));
