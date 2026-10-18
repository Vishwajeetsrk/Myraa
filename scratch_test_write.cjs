const fs = require('fs');

try {
  fs.writeFileSync('c:/Users/Vishwajeet/Music/Myraa/resources/app/dist/assets/test_write.js', '// test');
  console.log('Writing test_write.js succeeded!');
  fs.unlinkSync('c:/Users/Vishwajeet/Music/Myraa/resources/app/dist/assets/test_write.js');
  console.log('Unlink test_write.js succeeded!');
} catch (e) {
  console.log('Error writing in dist/assets:', e.message);
}
