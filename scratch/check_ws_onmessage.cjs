'use strict';
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'resources', 'app', 'dist', 'assets', 'index-qnLjC2CG.js');
const c = fs.readFileSync(file, 'utf8');

const wsOnMsgIdx = c.indexOf('this.ws.onmessage');
console.log('this.ws.onmessage at:', wsOnMsgIdx);
if (wsOnMsgIdx !== -1) {
  console.log(c.slice(wsOnMsgIdx, wsOnMsgIdx + 2000));
}
