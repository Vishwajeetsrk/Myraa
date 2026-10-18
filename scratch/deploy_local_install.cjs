'use strict';

const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.env.USERPROFILE, 'Desktop', 'MYRAA-Portable', 'MYRAA-Portable-8.3.4');
const dstDir = path.join(process.env.LOCALAPPDATA, 'Programs', 'MYRAA');

console.log('Source:', srcDir);
console.log('Destination:', dstDir);

if (!fs.existsSync(srcDir)) {
  console.error('Source directory does not exist!');
  process.exit(1);
}

if (!fs.existsSync(dstDir)) {
  fs.mkdirSync(dstDir, { recursive: true });
}

// Copy all files recursively from srcDir to dstDir
function copyRecursive(src, dst) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      if (!fs.existsSync(dstPath)) fs.mkdirSync(dstPath, { recursive: true });
      copyRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

console.log('[*] Deploying complete application to AppData\\Local\\Programs\\MYRAA...');
copyRecursive(srcDir, dstDir);

// Ensure MYRAA.exe exists (copy from MYRAA AI.exe if needed)
const exeSrc = path.join(dstDir, 'MYRAA AI.exe');
const exeDst = path.join(dstDir, 'MYRAA.exe');
if (fs.existsSync(exeSrc) && !fs.existsSync(exeDst)) {
  fs.copyFileSync(exeSrc, exeDst);
  console.log('[OK] Created MYRAA.exe from MYRAA AI.exe');
}

console.log('[OK] Application successfully deployed to:', dstDir);
console.log('[*] Destination contents:');
console.log(fs.readdirSync(dstDir));
