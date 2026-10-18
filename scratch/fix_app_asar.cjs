'use strict';

const fs = require('fs');
const path = require('path');
const asar = require('../resources/app/node_modules/@electron/asar');

async function patchAsar(asarPath) {
  if (!fs.existsSync(asarPath)) {
    console.log('[SKIP] Does not exist:', asarPath);
    return;
  }
  console.log('[*] Patching:', asarPath);
  const tempExtract = path.join(__dirname, 'temp_asar_extract_' + Date.now());
  if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
  fs.mkdirSync(tempExtract, { recursive: true });

  console.log('  1. Extracting app.asar...');
  asar.extractAll(asarPath, tempExtract);

  console.log('  2. Copying updated electron files...');
  const electronSrc = path.resolve(__dirname, '..', 'resources', 'app', 'electron');
  const electronDst = path.join(tempExtract, 'electron');
  if (!fs.existsSync(electronDst)) fs.mkdirSync(electronDst, { recursive: true });

  for (const f of ['main.cjs', 'recovery.html', 'recovery-preload.cjs', 'splash.html', 'splash-preload.cjs']) {
    const s = path.join(electronSrc, f);
    const d = path.join(electronDst, f);
    if (fs.existsSync(s)) {
      fs.copyFileSync(s, d);
      console.log(`    [OK] Copied ${f}`);
    }
  }

  console.log('  3. Re-packing app.asar...');
  const backupPath = asarPath + '.bak';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(asarPath, backupPath);
    console.log('    [OK] Created backup:', backupPath);
  }

  await asar.createPackage(tempExtract, asarPath);
  console.log('  4. Cleaning up temp...');
  fs.rmSync(tempExtract, { recursive: true, force: true });
  console.log('[SUCCESS] Patched:', asarPath);
}

async function main() {
  const targets = [
    path.join(process.env.LOCALAPPDATA, 'Programs', 'MYRAA', 'resources', 'app.asar'),
    path.join(process.env.USERPROFILE, 'Desktop', 'MYRAA-Portable', 'MYRAA-Portable-8.3.4', 'resources', 'app.asar')
  ];

  for (const t of targets) {
    await patchAsar(t);
  }
}

main().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
