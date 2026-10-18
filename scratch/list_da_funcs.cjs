const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/desktopAutomation.cjs', 'utf8');

const matches = [...s.matchAll(/([a-zA-Z0-9_]+)\s*:\s*function|\bfunction\s+([a-zA-Z0-9_]+)|([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/g)];
const funcs = matches.map(m => m[1] || m[2] || m[3]).filter(Boolean);
console.log('Sample functions in desktopAutomation.cjs:');
console.log([...new Set(funcs)].slice(0, 40));
