'use strict';
const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, 'resources', 'app', 'dist', 'assets', 'index-qnLjC2CG.js');
const content = fs.readFileSync(jsPath, 'utf8');

console.log('Bundle length:', content.length);

// Check WebSocket connections
const wsMatches = content.match(/new\s+WebSocket\([^)]+\)/g) || [];
console.log('WebSocket instantiations:', wsMatches);

// Check /live
const liveMatches = content.match(/[\w\.\/]*live[\w\.\/]*/g) || [];
console.log('/live matches sample:', liveMatches.slice(0, 5));

// Check chat or send
const sendMatches = content.match(/\.send\([^)]+\)/g) || [];
console.log('.send calls sample:', sendMatches.slice(0, 10));

// Check IPC
const ipcMatches = content.match(/electronAPI\.[a-zA-Z0-9_]+/g) || [];
console.log('electronAPI calls:', [...new Set(ipcMatches)]);
