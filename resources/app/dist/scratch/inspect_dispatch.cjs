const fs = require('fs');
const js = fs.readFileSync('C:/Users/Vishwajeet/Music/Myraa/resources/app/dist/server.cjs', 'utf8');

// Find where the tools end and what the execution logic does
const idx = 270146;
const chunk = js.slice(idx + 50000, idx + 80000);
console.log('After tools chunk preview:');
console.log(chunk.slice(0, 3000));
