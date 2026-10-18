const { execSync } = require('child_process');

try {
  const p = 'c:\\Users\\Vishwajeet\\Music\\Myraa\\resources\\app\\dist\\assets';
  const res = execSync(`powershell -NoProfile -Command "Get-Item '${p}' | Select-Object FullName, LinkType, Target"`).toString();
  console.log(res);
} catch (e) {
  console.log('Error:', e.message);
}
