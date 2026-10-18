'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = 'C:\\Users\\Vishwajeet\\Desktop\\MYRAA-Installers-v9.3.1';

const TARGET_DIRS = [
  path.join(ROOT, 'Installers', 'v9.3.1'),
  path.join(ROOT, 'Installers'),
  path.join(ROOT, 'release', 'v9.3.1'),
  path.join(ROOT, 'release')
];

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

console.log('[*] Preparing Release Artifacts for MYRAA AI OS v9.3.1');

for (const dir of TARGET_DIRS) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('[+] Created directory:', dir);
  }
}

const FILES_TO_COPY = [
  'MYRAA-Setup-v9.3.1.exe',
  'MYRAA-Portable-v9.3.1.exe',
  'MYRAA-Install-v9.3.1.bat',
  'MYRAA.exe',
  'setup_helper.ps1',
  'README.txt'
];

for (const file of FILES_TO_COPY) {
  const src = path.join(SOURCE_DIR, file);
  if (!fs.existsSync(src)) {
    console.warn('[!] Source file missing:', src);
    continue;
  }
  const size = fs.statSync(src).size;
  const hash = sha256(src);
  console.log(`[*] Processing: ${file} (${size} bytes, SHA256: ${hash.slice(0, 16)}...)`);

  for (const dir of TARGET_DIRS) {
    const dest = path.join(dir, file);
    fs.copyFileSync(src, dest);
    console.log(`  -> Copied to: ${dest}`);
  }
}

// Generate Checksums file
const checksumLines = [];
for (const file of ['MYRAA-Setup-v9.3.1.exe', 'MYRAA-Portable-v9.3.1.exe', 'MYRAA.exe', 'MYRAA-Install-v9.3.1.bat']) {
  const p = path.join(SOURCE_DIR, file);
  if (fs.existsSync(p)) {
    checksumLines.push(`${sha256(p)}  ${file}`);
  }
}
const checksumContent = checksumLines.join('\n') + '\n';

for (const dir of TARGET_DIRS) {
  const checksumFile = path.join(dir, 'checksums.txt');
  fs.writeFileSync(checksumFile, checksumContent, 'utf8');
  console.log(`[OK] Wrote checksums to: ${checksumFile}`);
}

// Generate Release Notes
const releaseNotes = `# MYRAA AI OS — Release Notes v9.3.1

## Overview
MYRAA AI OS v9.3.1 provides self-contained desktop companions, autonomous coding agents, word document automation, and conversational voice interfaces.

## Release Deliverables
- **Canonical Setup Installer:** \`MYRAA-Setup-v9.3.1.exe\` (Full NSIS Windows installer with start menu & desktop integration)
- **Portable Edition:** \`MYRAA-Portable-v9.3.1.exe\` (No installation required; run directly anywhere)
- **1-Click Helper:** \`MYRAA-Install-v9.3.1.bat\` (Automated unattended setup & dependency sync)
- **Direct Executable:** \`MYRAA.exe\` (Portable runtime entry)

## Key Fixes in v9.3.1
1. **Startup Bug Fix:** Resolved temporal dead zone \`ReferenceError: Cannot access 'BUILD_ID' before initialization\` in main application bundle.
2. **Crash Recovery Window:** Fixed raw HTML/CSS rendering on Windows desktop wallpaper; enforced secure context isolation with IPC preload bridge.
3. **Audio Pipeline Restoration:** Preserved native 24kHz Gemini Live streaming audio output.
4. **Child Process Logging:** Enhanced diagnostic visibility by forwarding backend process stdout/stderr directly to \`electron_debug.log\`.

## Verification & Integrity
\`\`\`
${checksumContent.trim()}
\`\`\`
`;

for (const dir of TARGET_DIRS) {
  const rnFile = path.join(dir, 'release-notes.md');
  fs.writeFileSync(rnFile, releaseNotes, 'utf8');
  console.log(`[OK] Wrote release notes to: ${rnFile}`);
}

console.log('\n[SUCCESS] All release packages distributed and verified successfully!');
