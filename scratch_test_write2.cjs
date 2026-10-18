const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'resources', 'app', 'dist', 'assets', 'test_write.txt');
console.log('Writing to:', target);
try {
  fs.writeFileSync(target, 'hello');
  console.log('Write succeeded!');
  fs.unlinkSync(target);
  console.log('Unlink succeeded!');
} catch (e) {
  console.log('Write failed:', e.message);
}
