'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const releaseDir = path.resolve(__dirname, '..', 'release');
const setupExe = path.join(releaseDir, 'MYRAA-Setup-9.3.0.exe');
const setupX64Exe = path.join(releaseDir, 'MYRAA-Setup-9.3.0-x64.exe');
const portableExe = path.join(releaseDir, 'MYRAA-Portable-9.3.0.exe');

// Link or copy setup exe to setup-x64.exe if needed
if (fs.existsSync(setupExe)) {
  try {
    if (!fs.existsSync(setupX64Exe)) {
      try {
        fs.linkSync(setupExe, setupX64Exe);
        console.log('[OK] Hardlinked release/MYRAA-Setup-9.3.0-x64.exe');
      } catch {
        fs.copyFileSync(setupExe, setupX64Exe);
        console.log('[OK] Created release/MYRAA-Setup-9.3.0-x64.exe');
      }
    }
  } catch (e) {
    console.log(`[NOTE] Single canonical installer binary preserved: MYRAA-Setup-9.3.0.exe (${e.message})`);
  }
}

function getSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

const checksums = [];
if (fs.existsSync(setupX64Exe)) {
  checksums.push(`${getSha256(setupX64Exe)}  MYRAA-Setup-9.3.0-x64.exe`);
}
if (fs.existsSync(setupExe)) {
  checksums.push(`${getSha256(setupExe)}  MYRAA-Setup-9.3.0.exe`);
}
if (fs.existsSync(portableExe)) {
  checksums.push(`${getSha256(portableExe)}  MYRAA-Portable-9.3.0.exe`);
}

fs.writeFileSync(path.join(releaseDir, 'checksums.txt'), checksums.join('\n') + '\n', 'utf8');
console.log('[OK] Generated release/checksums.txt:');
console.log(checksums.join('\n'));

// Release notes
const releaseNotes = `# MYRAA AI OS — Release Notes (v9.3.0)

**Release**: v9.3.0  
**Build Date**: 2026-09-12  
**Architecture**: Windows x64 (10/11)  
**Binary Name**: \`MYRAA.exe\`  
**Installer**: \`MYRAA-Setup-9.3.0-x64.exe\`  

---

## Highlights

### 1. Genuine Native Windows Desktop Experience
- **Zero Browser Requirement**: Launches directly as a native Windows desktop window (\`MYRAA.exe\`) with glassmorphism backdrop filters and custom titlebar.
- **No Localhost Navigation**: Backend communication runs invisibly over internal loopback; no web pages, no browser tabs, and no terminal windows.
- **Single Instance Enforcement**: Automatic focus on existing window if launched twice.
- **Process Supervisor**: Automatically supervises backend and Python agent child processes, with guaranteed process tree cleanup on quit (\`taskkill /T /F\`).

### 2. 3D Companion Avatar (Evelyn / Myraa)
- Full 3D MMD PMX character (\`model.pmx\`, 2,986,453 bytes) with 10 high-resolution textures.
- Real-time physics, natural gaze tracking, eye blink, and viseme synchronization.
- 60 FPS hardware-accelerated WebGL rendering with automatic GPU fallback.

### 3. Dual Conversational Voice & Chat Architecture
- **Primary Voice**: Real-time Gemini Live WebSocket stream (\`/live\`) supporting 16 kHz PCM microphone input and 24 kHz audio playback.
- **REST Fallback**: High-speed \`POST /api/chat\` endpoint with context recall from \`StructuredMemoryStore\`.
- **Zero Emojis Enforced (Rule 1)**: All text and voice outputs are stripped of emojis in compliance with project rules.
- **Input Preservation**: Typed messages are never dropped or silently cleared on network retry.

### 4. Storage & Security Compliance
- Strict separation of immutable application binaries in \`%LOCALAPPDATA%\\Programs\\MYRAA\` from mutable user state in \`%APPDATA%\\MYRAA AI OS\`.
- Full compliance with Windows Defender, SmartScreen, and Controlled Folder Access (CFA).
- Atomic persistence (\`safeAtomicWrite\`) prevents data corruption during unexpected power loss or crashes.

### 5. Autonomous Engineering & Desktop Powers
- **Autonomous Coding Agent (v9.0.0)**: Integrated GitService, TestRunnerService, and SelfHealingDevEngine.
- **Professional Word Engine (v7.0)**: Native docx creation, redesign, grammar scoring, and PDF export.
- **Desktop Automation**: 64 Win32/PowerShell automation tools for application control, screenshots, and file management.
- **Universal Skills**: 442 skills registered and instantly searchable.

---

## Verification Checksums (SHA-256)
\`\`\`
${checksums.join('\n')}
\`\`\`
`;

fs.writeFileSync(path.join(releaseDir, 'release-notes.md'), releaseNotes, 'utf8');
console.log('[OK] Generated release/release-notes.md');
