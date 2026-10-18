# MYRAA AI OS v9.4.0 — Production Installer Status & Deep Test Report

Built: 2026-10-18 · Config: `electron-builder.v2.yml` (NSIS + portable, x64, unsigned)

> Rebuilt 2026-10-18 19:55 with the Course Studio SQLite bridge fix (commit `19d9e07`).
> GitHub Release `v9.4.0` assets were replaced with this build; hashes below match it.
> Note: MCP stdio transport (Phase 25) landed on `main` after this build -- it is not
> in these installers and will ship with the next release batch.

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
FC7FF835B60A0BE12ACF428B593AE9AF39413B27366BC49B532952A6C70584C1  MYRAA-Setup-9.4.0.exe
DF5361A3257D002D31598813B5C58BA91B4DE8CFE5C0197FCAF0DA57351BB89D  MYRAA-Portable-9.4.0.exe
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
2. **GitHub Release upload:** published for `v9.4.0` — binaries exceed GitHub's 100 MB per-file limit, so Releases (not repo commits) is the distribution channel.
3. **MCP transports:** registry is bookkeeping only in these v9.4.0 installers; real stdio transport landed on `main` (Phase 25, unreleased) and ships with the next build; the http transport is still pending.

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
1. **[DONE]** GitHub Release `v9.4.0` published with Setup + Portable + `latest.yml` + blockmap (auto-updater feed ready); assets re-uploaded after the bridge-fix rebuild.
2. **[DONE]** Course-create 500 fixed: SQLite bridge dispatch folded into a single chain (one JSON line per command; previously 5 disjoint chains emitted a trailing `Unknown command`). Verified live: `POST /api/course-studio/courses` -> 200.
3. **[DONE on main, unreleased]** MCP stdio transport: real `initialize` handshake, `tools/list` caching, approval-gated `tools/call`, voice "probe mcp `<name>`", curated official-server presets (filesystem, memory, everything, git, fetch, time, sqlite), registry/validation suite (`tests/test_mcp_transport.cjs`, 31 checks, no spawned servers) plus live real-server verification via `MYRAA_MCP_LIVE=1` (verified against the official `server-everything`: probe + `tools/call` echo/get-sum). Pending: http transport + rebuild/re-release with this code.
4. Observability pass: timeline/event surfaces into the UI; security agent phase.

---

Copyright (c) 2026 Vishwajeet & Open Source Contributors — MIT License.
