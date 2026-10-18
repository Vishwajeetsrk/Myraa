const { execSync } = require('child_process');

try {
  const p = 'c:\\Users\\Vishwajeet\\Music\\Myraa\\resources\\app\\dist\\assets\\character-C0yD4mYn.js';
  const res = execSync(`powershell -NoProfile -Command "(Get-Item '${p}').Attributes"`).toString();
  console.log('Attributes:', res.trim());
} catch (e) {
  console.log('Error:', e.message);
}
