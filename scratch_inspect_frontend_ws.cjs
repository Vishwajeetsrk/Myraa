'use strict';
const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, 'resources', 'app', 'dist', 'assets', 'index-qnLjC2CG.js');
const c = fs.readFileSync(jsPath, 'utf8');

// Find onmessage handler for WebSocket
const wsOnMsgIdx = c.indexOf('.onmessage');
if (wsOnMsgIdx !== -1) {
  console.log('--- WS ONMESSAGE SNIPPET ---');
  console.log(c.slice(wsOnMsgIdx, wsOnMsgIdx + 800));
} else {
  console.log('No .onmessage found, searching addEventListener("message"');
  const addEvtIdx = c.indexOf('"message"');
  console.log(c.slice(addEvtIdx - 50, addEvtIdx + 300));
}
