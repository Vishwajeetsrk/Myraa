const fs = require('fs');
const js = fs.readFileSync('C:/Users/Vishwajeet/Music/Myraa/resources/app/dist/server.cjs', 'utf8');
console.log(js.slice(312900, 320000));
