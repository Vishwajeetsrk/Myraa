const fs = require('fs');

const code = fs.readFileSync('C:/Users/Vishwajeet/Videos/MYRAA/resources/app/dist/server.cjs', 'utf8');
const start = 219800;
const len = 6000;
console.log(code.substring(start, start + len));
