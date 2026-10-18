const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'ui-health-patch.js.backup_v75');
const dst = path.join(__dirname, 'ui-health-patch.js');

try {
  const content = fs.readFileSync(src, 'utf8');
  console.log('Read source successfully, length:', content.length);
  fs.writeFileSync(dst, content, 'utf8');
  console.log('Wrote destination successfully!');
} catch (e) {
  console.error('Error during patch runner:', e);
}
