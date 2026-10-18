const { execSync } = require('child_process');

try {
  const p8016 = execSync('powershell -NoProfile -Command "Get-Process -Id 8016 -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Path"').toString();
  console.log('8016:', p8016);
} catch (e) {
  console.log('8016 error:', e.message);
}
