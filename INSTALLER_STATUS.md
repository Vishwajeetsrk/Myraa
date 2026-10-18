# MYRAA AI OS v9.4.0 — Production Installer Status & Deep Test Report

Built: 2026-10-18 · Config: `electron-builder.v2.yml` (NSIS + portable, x64, unsigned)

## 1. Deep Testing & Verification Summary

| Component | Status | Verification Details |
|-----------|--------|----------------------|
| **Core Express Backend** | **[OK] Verified** | Boots on `http://0.0.0.0:3000 (LAN & Mobile)`; all phase mounts log clean: evidence routes, connector market (8 agi tools), model gateway (2), event bus (1), task timeline (2), permissions + MCP (4) |
| **Test Suites** | **[OK] Verified** | 286 live checks across 9 suites, all green (evidence 29, investigation 37, workspace 43, connector market 26, model gateway 34, safety broker 31, event bus 25, timeline 27, permissions + MCP 34) |
| **Packaged App Bundle** | **[OK] Verified** | `app.asar.unpacked\dist` contains all v9.4.0 modules (`event_bus.cjs`, `task_timeline.cjs`, `tool_permissions.cjs`, `mcp_manager.cjs`, `safety_broker.cjs`, ...) |
| **Electron Main Process** | **[OK] Verified** | Electron 31.7.7, single instance lock, clean window creation |
| **Voice / Audio Engine** | **[OK] Verified** | Gemini Live streaming audio restore intact; all v9.4.0 voice intents classified correctly (18/18 probe checks) |
| **Hash Integrity** | **[OK] Verified** | Source == pack SHA256 re-verified after copy by the release packer |

---

## 2. Installer Windows EXE Files

The production installer packages for **v9.4.0** are generated, verified, and placed in the target locations:

### Canonical Distribution Paths:
1. **Primary Working Binaries:**
   `C:\Users\Vishwajeet\Desktop\MYRAA-Installers-v9.4.0\`
   - `MYRAA-Setup-9.4.0.exe` (308.9 MB — Full NSIS Windows Setup)
   - `MYRAA-Portable-9.4.0.exe` (302.9 MB — Portable Single-File Executable)

2. **Workspace Installers Directory:**
   `C:\Users\Vishwajeet\Music\Myraa\Installers\v9.4.0\`
   - `MYRAA-Setup-9.4.0.exe`
   - `MYRAA-Portable-9.4.0.exe`
   - `MYRAA-Install-v9.4.0.bat` (adapted from v9.3.1 lifecycle engine)
   - `SHA256SUMS.txt`, `checksums.txt`, `README.txt`

3. **Build Output:**
   `C:\Users\Vishwajeet\Music\Myraa\resources\app\dist-release\`
   - `MYRAA-Setup-9.4.0.exe`, `MYRAA-Portable-9.4.0.exe`, `win-unpacked\`, `latest.yml`

---

## 3. SHA256 Integrity Verification

```
2D9158067C61406AA06172D02C4572AF1CF3039406D27AB8BF106F108ABA6B80  MYRAA-Setup-9.4.0.exe
DD1EC0C05B26C32197E1069F4AB105C2A669401926EE86C28ADFB62E4ACD56DA  MYRAA-Portable-9.4.0.exe
```

Batched copies (SMB differs from cache, not integrity). The packer re-hashes every file after copy.

---

## 4. Architectural Analysis: [What is Working, What is Missing, Next Plan]

### [A] What is Working:
1. **Autonomous Operations Stack live:** evidence engine, investigation toolkit, agent workspace, connector market, model gateway, safety broker, event bus, task timeline, tool permissions + MCP registry — all mounted, tested, and voice-addressable.
2. **Boot log is the single source of truth:** every phase prints its mount line; nothing fails silently.
3. **Release pipeline reproducible:** `npm run dist:win` → `phase14_release_pack.ps1` → versioned pack + Desktop copy + hashes.

### [B] What is Missing / Limitations:
1. **EV Code Signing Certificate:** installers are unsigned; Windows SmartScreen shows an unknown publisher warning on first launch until accepted once.
2. **GitHub Release upload:** binaries exceed GitHub's 100 MB per-file limit; publish via GitHub Releases (not repo commits) when ready.
3. **MCP transports:** registry is bookkeeping only in v9.4.0; real stdio/http transport execution lands in the next cycle (permission enforcement hooks in with it).

### [C] How It Works:
- **NSIS Setup (`MYRAA-Setup-9.4.0.exe`):**
  1. Prompts user for destination (`%LOCALAPPDATA%\Programs\MYRAA` by default; elevation allowed).
  2. Unpacks Electron 31 runtime and production `app.asar` (+ `app.asar.unpacked\dist`).
  3. Registers Add/Remove Programs uninstaller; Desktop + Start Menu shortcuts (`MYRAA`).
- **Portable Edition (`MYRAA-Portable-9.4.0.exe`):**
  1. Self-extracts into a temporary sandbox and runs directly without modifying registry or user profiles.
- **1-Click Batch (`MYRAA-Install-v9.4.0.bat`):**
  1. Runs the setup executable and registers shortcuts.

### [D] Next Plan:
1. Upload v9.4.0 installers to GitHub Releases (tag `v9.4.0`) for the auto-updater feed.
2. MCP transport execution (stdio + http) with per-agent permission enforcement wired into the tool engine.
3. Observability pass: timeline/event surfaces into the UI; course-create 500 fix; security agent phase.

---

Copyright (c) 2026 Vishwajeet & Open Source Contributors — MIT License.
