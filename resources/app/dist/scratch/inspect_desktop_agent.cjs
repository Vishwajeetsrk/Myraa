const fs = require('fs');
const js = fs.readFileSync('C:/Users/Vishwajeet/Music/Myraa/resources/app/dist/server.cjs', 'utf8');

const idx = js.indexOf('async function callDesktopAgent');
console.log(js.slice(idx, idx + 2000));
