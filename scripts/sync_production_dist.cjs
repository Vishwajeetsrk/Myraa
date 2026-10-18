'use strict';

const fs = require('fs');
const path = require('path');

const distSrc = path.resolve(__dirname, '..', 'resources', 'app', 'dist');
const electronSrc = path.resolve(__dirname, '..', 'resources', 'app', 'electron');

const distFiles = [
  'server.cjs',
  'myraa_v6_real_routes.cjs',
  'office_doc_engine.cjs',
  'unified_capability_router.cjs',
  'desktopAutomation.cjs',
  'autoUpdateEngine.cjs',
  'index.html',
  path.join('assets', 'index-qnLjC2CG.js'),
  path.join('assets', 'character-C0yD4mYn.js'),
  path.join('assets', 'index-DAtgVL5Z.css'),
  path.join('assets', 'three-BBlFD6pU.js')
];

const electronFiles = [
  'main.cjs',
  'recovery.html',
  'recovery-preload.cjs',
  'splash.html',
  'splash-preload.cjs'
];

const targetDirs = [
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MYRAA', 'resources', 'app.asar.unpacked', 'dist'),
  path.join('C:', 'Program Files', 'MYRAA', 'MYRAA', 'resources', 'app.asar.unpacked', 'dist'),
  path.join(process.env.USERPROFILE || '', 'Desktop', 'MYRAA-Portable', 'MYRAA-Portable-8.3.4', 'resources', 'app.asar.unpacked', 'dist'),
  path.resolve(__dirname, '..', 'resources', 'app', 'release', 'win-unpacked', 'resources', 'app.asar.unpacked', 'dist')
];

for (const dir of targetDirs) {
  if (fs.existsSync(dir)) {
    // 1. Sync dist files
    for (const f of distFiles) {
      const srcFile = path.join(distSrc, f);
      const dstFile = path.join(dir, f);
      if (fs.existsSync(srcFile)) {
        const dstParent = path.dirname(dstFile);
        if (!fs.existsSync(dstParent)) fs.mkdirSync(dstParent, { recursive: true });
        fs.copyFileSync(srcFile, dstFile);
        console.log(`[OK] Synced dist ${f} -> ${dstFile}`);
      }
    }

    // 2. Sync electron runtime files if electron dir exists in destination
    const appRoot = path.resolve(dir, '..');
    const electronDst = path.join(appRoot, 'electron');
    if (fs.existsSync(electronDst)) {
      for (const ef of electronFiles) {
        const srcEf = path.join(electronSrc, ef);
        const dstEf = path.join(electronDst, ef);
        if (fs.existsSync(srcEf)) {
          fs.copyFileSync(srcEf, dstEf);
          console.log(`[OK] Synced electron ${ef} -> ${dstEf}`);
        }
      }
    }

    // 3. Sync meta files
    const metaFiles = ['version.json', 'package.json'];
    for (const mf of metaFiles) {
      const srcMeta = path.resolve(__dirname, '..', 'resources', 'app', mf);
      const dstMeta = path.join(appRoot, mf);
      if (fs.existsSync(srcMeta)) {
        fs.copyFileSync(srcMeta, dstMeta);
        console.log(`[OK] Synced meta ${mf} -> ${dstMeta}`);
      }
    }
  }
}
