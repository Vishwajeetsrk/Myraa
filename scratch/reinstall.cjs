const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('[1] Running installer: release/MYRAA-Setup-9.3.0.exe /S...');
execSync('release\\MYRAA-Setup-9.3.0.exe /S', { stdio: 'inherit' });

console.log('[2] Waiting for files to settle...');
let found = false;
const exe = path.join(process.env.LOCALAPPDATA, 'Programs', 'MYRAA', 'MYRAA.exe');

for (let i = 0; i < 30; i++) {
  if (fs.existsSync(exe)) {
    found = true;
    break;
  }
  const start = Date.now();
  while (Date.now() - start < 1000) {}
}

console.log('[3] MYRAA.exe exists:', found, exe);
if (found) {
  console.log('    Size:', fs.statSync(exe).size, 'bytes');
}
