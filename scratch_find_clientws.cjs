'use strict';
const fs = require('fs');
const lines = fs.readFileSync('./resources/app/dist/server.cjs', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('clientWs.on')) {
    console.log(i + 1, l);
  }
});
