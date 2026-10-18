'use strict';
const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, 'resources', 'app', 'dist', 'assets', 'index-qnLjC2CG.js');
const c = fs.readFileSync(jsPath, 'utf8');

const wsIdx = c.indexOf('this.ws=new WebSocket');
if (wsIdx !== -1) {
  console.log('--- WS SETUP & ONMESSAGE (1200..3200 chars) ---');
  console.log(c.slice(wsIdx + 1200, wsIdx + 3200));
}
