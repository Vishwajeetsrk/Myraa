'use strict';

const fs = require('fs');

function patchAsar(asarPath) {
  if (!fs.existsSync(asarPath)) {
    console.log('[SKIP] File does not exist:', asarPath);
    return;
  }
  console.log('[*] Patching asar:', asarPath);
  const buf = fs.readFileSync(asarPath);

  // Exact bytes: dlog(`MYRAA build: ${BUILD_ID}`); (33 bytes)
  const target1 = Buffer.from([0x64, 0x6c, 0x6f, 0x67, 0x28, 0x60, 0x4d, 0x59, 0x52, 0x41, 0x41, 0x20, 0x62, 0x75, 0x69, 0x6c, 0x64, 0x3a, 0x20, 0x24, 0x7b, 0x42, 0x55, 0x49, 0x4c, 0x44, 0x5f, 0x49, 0x44, 0x7d, 0x60, 0x29, 0x3b]);
  const replace1 = Buffer.from('dlog("MYRAA build: v9.3.1-fix ");');

  if (target1.length !== replace1.length) {
    throw new Error(`Length mismatch: target=${target1.length}, replace=${replace1.length}`);
  }

  let count1 = 0;
  let idx1 = buf.indexOf(target1);
  while (idx1 !== -1) {
    replace1.copy(buf, idx1);
    count1++;
    idx1 = buf.indexOf(target1, idx1 + 1);
  }
  console.log(`  [OK] Patched BUILD_ID TDZ occurrences: ${count1}`);

  fs.writeFileSync(asarPath, buf);
  console.log('[SUCCESS] Saved patched asar:', asarPath);
}

patchAsar('C:\\Users\\Vishwajeet\\AppData\\Local\\Programs\\MYRAA\\resources\\app.asar');
patchAsar('C:\\Users\\Vishwajeet\\Desktop\\MYRAA-Portable\\MYRAA-Portable-8.3.4\\resources\\app.asar');
