const fs = require('fs');
const js = fs.readFileSync('C:/Users/Vishwajeet/Music/Myraa/resources/app/dist/server.cjs', 'utf8');

const promptStart = js.indexOf('CAPABILITIES AND OPERATING CONTRACT:');
console.log(js.slice(promptStart, promptStart + 5000));
