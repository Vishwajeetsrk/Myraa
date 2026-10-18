# MYRAA AI OS v9.5.0 — Production Installer Status & Deep Test Report

Built: 2026-10-18 · Config: `electron-builder.v2.yml` (NSIS + portable, x64, unsigned)

> v9.5.0 includes the full MCP stack: real stdio transport (initialize / tools/list / tools/call),
> curated official-server presets, the Course Studio SQLite bridge fix, and the real-only MCP policy
> (no fake server fixtures; real-server verification is env-gated via `MYRAA_MCP_LIVE=1`).
> GitHub Release v9.5.0 is published (4 assets uploaded, verified) and the Setup was silently installed on this machine:
> `%LOCALAPPDATA%\Programs\MYRAA` with shortcuts + uninstaller, backend smoke-tested from the installed runtime.

## 1. Deep Testing & Verification Summary

| Component | Status | Verification Details |
|-----------|--------|----------------------|
| **Core Express Backend** | **[OK] Verified** | Boots on `http://0.0.0.0:3000 (LAN & Mobile)`; all phase mounts log clean: evidence routes, connector market (8 agi tools), model gateway (2), event bus (1), task timeline (2), permissions + MCP (6: permissions 2 + mcp 4) |
| **Test Suites** | **[OK] Verified** | 317 live checks across the 10 documented suites, all green (evidence 29, investigation 37, workspace 43, connector market 26, model gateway 34, safety broker 31, event bus 25, timeline 27, permissions + MCP 34, MCP transport 31) plus all 14 auxiliary suites (pointer x6, compute x2, course x2, tutor x2, gesture, paths) exit=0 |
| **MCP Real-Server Verification** | **[OK] Verified** | `MYRAA_MCP_LIVE=1` run against the official `npx -y @modelcontextprotocol/server-everything`: probe OK, 13 real tools listed, `tools/call echo` and `get-sum` returned real results ("The sum of 40 and 2 is 42.") |
| **Packaged App Bundle** | **[OK] Verified** | `app.asar.unpacked\dist` contains `mcp_stdio_client.cjs`, `mcp_manager.cjs` (presets), fixed single-dispatch `sqlite_memory_bridge.py` (1 chain start + 34 elif), `version.json` = 9.5.0. Packaged server smoke test on port 3005: health 9.5.0, 7 presets, real probe (13 tools), real `get-sum` call |
| **Real Windows Install** | **[OK] Verified** | `MYRAA-Setup-9.5.0.exe /S` silent install (exit 0) to `%LOCALAPPDATA%\Programs\MYRAA`; Desktop + Start Menu shortcuts created; Add/Remove registration "MYRAA AI OS 9.5.0". Installed-runtime smoke (via `ELECTRON_RUN_AS_NODE=1 MYRAA.exe server.cjs`, port 3006): health 9.5.0, 7 presets, preset add OK, real MCP probe (13 tools), real `get-sum` call ("The sum of 20 and 22 is 42."). Real app window launched from installed EXE with backend on port 3000 |
| **Electron Main Process** | **[OK] Verified** | Electron 31.7.7, single instance lock, clean window creation |
| **Voice / Audio Engine** | **[OK] Verified** | Gemini Live streaming audio restore intact; all voice intents classified correctly (18/18 probe checks) + new `mcp_probe` intent ("probe mcp `<name>`") verified via orchestrator |
| **Hash Integrity** | **[OK] Verified** | Source == pack SHA256 re-verified after copy by the release packer |

---

## 2. Installer Windows EXE Files

The production installer packages for **v9.5.0** are generated, verified, and placed in the target locations:

### Canonical Distribution Paths:
1. **Primary Working Binaries (Desktop):**
   `C:\Users\Vishwajeet\Desktop\MYRAA-Installers-v9.5.0\`
   - `MYRAA-Setup-9.5.0.exe` (308.9 MB — Full NSIS Windows Setup)
   - `MYRAA-Portable-9.5.0.exe` (303.0 MB — Portable Single-File Executable)

2. **Workspace Installers Directory:**
   `C:\Users\Vishwajeet\Music\Myraa\Installers\v9.5.0\`
   - `MYRAA-Setup-9.5.0.exe`
   - `MYRAA-Portable-9.5.0.exe`
   - `MYRAA-Install-v9.5.0.bat` (adapted from v9.4.0 lifecycle engine)
   - `SHA256SUMS.txt`, `checksums.txt`, `README.txt`

3. **Build Output:**
   `C:\Users\Vishwajeet\Music\Myraa\resources\app\dist-release\`
   - `MYRAA-Setup-9.5.0.exe`, `MYRAA-Portable-9.5.0.exe`, `win-unpacked\`, `latest.yml`

4. **GitHub Release (published):**
   `https://github.com/Vishwajeetsrk/Myraa/releases/tag/v9.5.0`
   - `MYRAA-Setup-9.5.0.exe` (308.9 MB), `MYRAA-Portable-9.5.0.exe` (303.0 MB), `latest.yml`, `MYRAA-Setup-9.5.0.exe.blockmap` (all state=uploaded, release id 416603210)

---

## 3. SHA256 Integrity Verification

```
1CF36B8EC0F217288B28F80485AB6D06EEEFFEEBC2A117C75E549110A7E4910C  MYRAA-Setup-9.5.0.exe
90745EB3CDA6C93EB205C4652F7D70D518C5B8F104CC1D818BC508F7C37FA48C  MYRAA-Portable-9.5.0.exe
```

The packer re-hashes every file after copy (source == pack).

---

## 4. Architectural Analysis: [What is Working, What is Missing, Next Plan]

### [A] What is Working:
1. **Autonomous Operations Stack live:** evidence engine, investigation toolkit, agent workspace, connector market, model gateway, safety broker, event bus, task timeline, tool permissions - all mounted, tested, and voice-addressable.
2. **MCP is real:** stdio transport (initialize + tools/list + tools/call), approval-gated `mcp_call` (HIGH), `mcp_probe` (MEDIUM), curated official-server presets (filesystem, memory, everything, git, fetch, time, sqlite) via `/api/mcp/presets(.add)`; http transport stays honest with `NOT_IMPLEMENTED`. No fake server fixtures ship.
3. **Boot log is the single source of truth:** every phase prints its mount line; nothing fails silently.
4. **Release pipeline reproducible:** `npm run dist:win` -> `phase14_release_pack.ps1` -> versioned pack + Desktop copy + hashes.

### [B] What is Missing / Limitations:
1. **EV Code Signing Certificate:** installers are unsigned; Windows SmartScreen shows an unknown publisher warning on first launch until accepted once.
2. **GitHub Release:** `v9.5.0` is published (4 assets, id 416603210); `v9.4.0` remains the previous release (uploads go to Releases, not repo commits - binaries exceed GitHub's 100 MB per-file limit).
3. **MCP http transport:** still pending; stdio-only for now (honest `NOT_IMPLEMENTED`).
4. **Observability dashboard:** timeline/event UI surfaces not wired into the front end yet.

### [C] How It Works:
- **NSIS Setup (`MYRAA-Setup-9.5.0.exe`):**
  1. Prompts user for destination (`%LOCALAPPDATA%\Programs\MYRAA` by default; elevation allowed).
  2. Unpacks Electron 31 runtime and production `app.asar` (+ `app.asar.unpacked\dist`).
  3. Registers Add/Remove Programs uninstaller; Desktop + Start Menu shortcuts (`MYRAA`).
- **Portable Edition (`MYRAA-Portable-9.5.0.exe`):**
  1. Self-extracts into a temporary sandbox and runs directly without modifying registry or user profiles.
- **1-Click Batch (`MYRAA-Install-v9.5.0.bat`):**
  1. Runs the setup executable and registers shortcuts.

### [D] Next Plan:
1. **[DONE]** v9.5.0 built, packed, hash-verified; packaged bundle live-verified with a real MCP server (probe + tool call).
2. **[DONE]** Course-create 500 fixed (SQLite bridge single dispatch); live check `POST /api/course-studio/courses` -> 200.
3. **[DONE]** MCP stdio transport + presets + voice intent + real-only test policy.
4. **[DONE]** GitHub Release `v9.5.0` published: Setup + Portable + latest.yml + blockmap uploaded (release id 416603210, `https://github.com/Vishwajeetsrk/Myraa/releases/tag/v9.5.0`); tag `v9.5.0` -> `cd7d51b`.
5. **[DONE]** Real Windows install verified: silent setup install, shortcuts, uninstaller, installed-runtime MCP smoke (real probe + real tool call), app window launched.
6. **[PENDING]** MCP http transport; observability pass (timeline/event surfaces into the UI).

---

Copyright (c) 2026 Vishwajeet & Open Source Contributors — MIT License.
