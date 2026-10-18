const { execSync } = require('child_process');

try {
  const res = execSync('powershell -NoProfile -Command "Get-Process *myraa* | Select-Object Id, ProcessName, Path"').toString();
  console.log(res);
} catch (e) {
  console.log('Error:', e.message);
}
