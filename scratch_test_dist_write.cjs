const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'resources', 'app', 'dist', 'test_write.txt');
console.log('Writing to:', target);
try {
  fs.writeFileSync(target, 'hello');
  console.log('Write in dist succeeded!');
  fs.unlinkSync(target);
  console.log('Unlink in dist succeeded!');
} catch (e) {
  console.log('Write in dist failed:', e.message);
}
