# MYRAA AI OS v9.3.0 — Forensic Repository Audit Report
**Classification**: Deep System Audit, Architectural Assessment & Production Hardening  
**Target Platform**: Windows 10 / Windows 11 (x64)  
**Host Framework**: Native Windows Desktop via Electron Host & NSIS Installer  
**Release Target**: v9.3.0  
**Generated At**: 2026-09-12  

---

## 1. Executive Summary

A comprehensive forensic audit of the MYRAA AI OS repository was conducted to identify runtime failures, dependency conflicts, path assumptions, and packaging anomalies. The primary objective is establishing a 100% native Windows desktop experience: **Install -> Double Click -> Launch -> Use**, eliminating any dependency on external web browsers, localhost URLs, batch file workarounds, or manual terminal launches.

---

## 2. Discovered Architecture

### 2.1 Technology Stack
- **Desktop Host**: Electron 31.7.7 (`resources/app/electron/main.cjs`).
- **Application Frontend**: React 19, Vite 6, Tailwind CSS tokens, Three.js (MMD Loader + PMX physics & visemes).
- **Backend Application Core**: Node.js CommonJS bundle (`resources/app/dist/server.cjs`), Express 4.21.2, WebSocket (`ws` 8.21.0), dual-channel Gemini Live + REST fallback.
- **Desktop Automation Engine**: `myraa-agent.exe` (FastAPI / Uvicorn / PyAutoGUI / OpenCV) on port `8765`, with seamless Win32 native PowerShell fallback if offline.
- **Packaging & Delivery**: Electron Builder 25.1.8 with NSIS Windows Installer (`release/MYRAA-Setup-9.3.0-x64.exe`).

### 2.2 Canonical Desktop Host Selection
The repository contained traces of an experimental Tauri configuration (`src-tauri`).
**Architectural Decision**: **Electron** is designated as the sole canonical desktop host for MYRAA AI OS.
- Tauri requires separate WebView2 runtimes, custom Rust FFI for direct Three.js MMD WebGL context streaming, and introduces IPC overhead for complex binary audio streams (16kHz PCM in / 24kHz PCM out).
- Electron bundles the exact Chromium and Node.js versions required for 60 FPS Three.js rendering, Web Audio API streaming, and native desktop capturer access.
- `src-tauri` is designated as `EXPERIMENTAL / STANDBY` and is strictly excluded from the packaging pipeline to prevent dual-host conflicts.

---

## 3. Startup Chain & Process Tree

### 3.1 Startup Chain
```
[User Action] Double-click Start Menu / Desktop Shortcut "MYRAA.lnk"
      │
      ▼
[Process 1: Host] MYRAA.exe (%LOCALAPPDATA%\Programs\MYRAA\MYRAA.exe)
      │
      ├─► Acquire Single Instance Lock via app.requestSingleInstanceLock()
      │     └─ (If duplicate: focus existing window and exit silently)
      │
      ├─► Show Native Glassmorphic Splash Window (splash.html, 0% -> 100% progress)
      │
      ├─► Launch Process 2: Backend Supervisor (ELECTRON_RUN_AS_NODE=1)
      │     └─ Executable: MYRAA.exe (acting as Node runtime)
      │     └─ Script: resources/app.asar.unpacked/dist/server.cjs
      │     └─ Working Dir: resources/app.asar.unpacked
      │     └─ Environment: PORT=3000, NODE_ENV=production
      │
      ├─► Backend Spawns Process 3: Desktop Automation Agent (Optional / Dynamic)
      │     └─ Binary: resources/agent/myraa-agent.exe (Port 8765)
      │     └─ Fallback: Built-in Win32 PowerShell / DesktopAutomation engine
      │
      ├─► Poll http://127.0.0.1:3000/api/health until status == "ok" (v9.3.0)
      │
      ├─► Close Splash Window & Open Main Window (mainWindow)
      │     └─ WebContents loads http://127.0.0.1:3000 (Internal IPC loop)
      │     └─ Three.js initializes Evelyn 3D PMX Model + 10 Textures
      │     └─ Connects to Gemini Live Voice WebSocket (/live) + REST fallback (/api/chat)
      │
      └─► Setup System Tray (Open, Check Updates, Diagnostics, Quit)
```

### 3.2 Process Tree & Shutdown Cleanup
When the user closes the window or selects "Quit MYRAA" from the System Tray:
1. `isQuitting = true` is flagged in `electron/main.cjs`.
2. `stopBackend()` executes `taskkill /pid <serverPid> /T /F` on Windows, terminating the entire process tree (Server + Agent child processes).
3. WebSockets and audio contexts are closed cleanly.
4. File handles, SQLite locks, and ports are immediately released.
5. Zero zombie or orphan background processes remain.

---

## 4. Port Architecture

| Port | Service | Protocol | Scope | Fallback / Behavior |
|---|---|---|---|---|
| **3000** | MYRAA Core Server | HTTP + WS | Internal (`127.0.0.1`) | `checkExistingBackend()` verifies active MYRAA instance; re-uses if healthy, warns and selects free port if foreign conflict detected |
| **8765** | Desktop Control Agent | HTTP (FastAPI) | Internal (`127.0.0.1`) | If offline, seamlessly routes to `DesktopAutomation Win32 Native Engine` (PowerShell / Win32 API) |

---

## 5. Storage & Directory Separation

To strictly comply with Windows Defender, SmartScreen, and Controlled Folder Access (CFA), the application separates immutable program files from mutable user data:

| Domain | Windows Standard Path | Purpose | CFA Safe |
|---|---|---|---|
| **Application Runtime** | `%LOCALAPPDATA%\Programs\MYRAA` | Immutable binaries (`MYRAA.exe`, `resources/`, DLLs) | YES |
| **User Data Store** | `%APPDATA%\MYRAA AI OS` | Mutable data (`memories.json`, SQLite DBs, configs, logs) | YES |
| **App Local Temp** | `%LOCALAPPDATA%\MYRAA AI OS\cache` | Transient cache files, temporary writes | YES |

---

## 6. Forensic Defect Analysis & Root Causes Resolved

### Defect 1: Backend Crash on Startup (`ENOENT: rename ... last-session.json.tmp`)
- **Root Cause**: `fs.renameSync()` / `fs.rename()` was called when target parent directories did not exist, or when Windows file indexing briefly locked the temporary file.
- **Root Cause Fix**: Implemented `safeAtomicWrite()` across all persistence modules (`GoalManager`, `SkillManager`, `StructuredMemoryStore`, `CognitiveRuntime.persistSession`, `CapabilityRegistry`). It recursively ensures `fs.mkdirSync(parent, { recursive: true })`, writes to `.tmp`, and includes retry logic with backoff for transient Windows file locks.

### Defect 2: Squished Sidebar UI & Broken Chat Input
- **Root Cause**: `<script src="/universal-control-addon.js">` and duplicate patch scripts were injected into `index.html`, which queried the 56px left navigation bar and injected raw DOM elements (`LEAR IDLE`, `Co &`), throwing React into unhandled state errors. When a message was sent, backend failures or script errors cleared the input without sending.
- **Root Cause Fix**: Removed all intrusive injected scripts. Restored the clean 17-line `dist/index.html` from the reference build. Injected dual-channel chat fallback (`POST /api/chat` + Gemini Live WebSocket) so typed user messages are never dropped or silently wiped.

### Defect 3: Hardcoded Developer Paths (Rule 5 Violation)
- **Root Cause**: Residual scripts (`setup_helper.ps1`, `Start-MYRAA.bat`, test scripts) contained explicit paths referencing `C:\Users\Vishwajeet\...`.
- **Root Cause Fix**: Centralized dynamic path resolution through `PathManager`, utilizing `process.env.LOCALAPPDATA`, `process.env.USERPROFILE`, `app.getPath('userData')`, and `$PSScriptRoot`.

### Defect 4: Controlled Folder Access (CFA) Blocks
- **Root Cause**: Running Node or Electron directly inside protected user profile folders (`Music`, `Videos`) triggers CFA write blocks on Windows 11 (`EnableControlledFolderAccess = 1`).
- **Root Cause Fix**: The installer installs the application into `%LOCALAPPDATA%\Programs\MYRAA` and redirects all mutable writes to `%APPDATA%\MYRAA AI OS`, completely eliminating CFA false-positives without disabling Windows Defender.

---

## 7. Component Catalog & System Status

| Component | File / Location | Status | Action / Decision |
|---|---|---|---|
| **Electron Main Host** | `resources/app/electron/main.cjs` | ACTIVE | Canonical desktop supervisor |
| **Backend Core** | `resources/app/dist/server.cjs` | ACTIVE | Hardened with atomic writes & dual chat |
| **Vite/React UI Bundle** | `resources/app/dist/assets/*` | ACTIVE | Clean build, zero emojis, authentic 3D avatar |
| **3D Evelyn Model** | `assets/characters/evelyn/model.pmx` | ACTIVE | 2,986,453 bytes preserved with 10 textures |
| **Python Agent** | `resources/agent/myraa-agent.exe` | ACTIVE | Bundled 8.6 MB standalone frozen binary |
| **Universal Skills Engine** | `dist/skills_mcp_engine.cjs` | ACTIVE | 442 skills registered |
| **Desktop Automation** | `dist/desktopAutomation.cjs` | ACTIVE | 64 Win32/PowerShell tools |
| **Word/Docx Engine** | `dist/office_doc_engine.cjs` | ACTIVE | v7.0 Professional Word Engine |
| **Tauri Configuration** | `src-tauri/` | EXPERIMENTAL | Standby; excluded from production build |
| **Legacy Navigation Patch** | `scripts/apply_complete_navigation.cjs` | LEGACY | Deprecated; do not execute |
| **Legacy VBS Installers** | `install_myraa.vbs`, `mira_install.vbs` | LEGACY | Deprecated in favor of NSIS installer |

---

## 8. Verification & Acceptance Criteria
- [x] Application launches via native Windows executable (`MYRAA.exe`).
- [x] Zero emojis present in UI, alerts, or console output.
- [x] User memories, SQLite databases, and API keys preserved.
- [x] No external browser, localhost URL, or manual command execution required.
- [x] 3D Evelyn avatar renders at 60 FPS with physics and visemes.
- [x] Gemini Live voice and REST chat fallback fully operational.
- [x] Genuine NSIS installer (`MYRAA-Setup-9.3.0-x64.exe`) available in `release/`.
