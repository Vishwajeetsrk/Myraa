# MYRAA AI OS v9.6.3 - Production Installer Status & Test Report

> **Current status (2026-11-20, v9.8.0).** The source tree, version files and documentation have been
> updated to 9.8.0 and the new backend services were live-tested from source. The installer binaries in
> `resources/app/dist-release/` and the Desktop installer pack are **stale** (9.6.3 / 9.7.0 era) and do
> **not** contain the 9.8.0 changes. They are unsigned; an EV certificate is still required for a signed
> release. Do not claim the installed app has the 9.8.0 features until a new build is produced and
> smoke-tested. The historical 9.6.3 report below is retained unchanged.

Built: 2026-11-18 · Config: `electron-builder.v2.yml` (NSIS + portable, x64, unsigned)

> **Packaged startup fix.** v9.6.2 installers showed only "MYRAA is starting… Checking installation and
> resolving paths." because the packaged backend died with `MODULE_NOT_FOUND: call-bind-apply-helpers`
> (express -> qs -> side-channel -> dunder-proto chain). electron-builder packed that dependency only
> under `call-bind/node_modules`, while `dunder-proto` resolved it from the asar root. v9.6.3 registers
> all nested asar `node_modules` directories in the backend's NODE_PATH at launch. The installed app
> now reaches `GET /api/health` and creates the main window.
> GitHub Release **v9.6.3 is live** at `https://github.com/Vishwajeetsrk/Myraa/releases/tag/v9.6.3` (4 assets uploaded, id 449659588).

## 1. Verification summary

| Component | Status | Verification details |
|-----------|--------|----------------------|
| Real Windows install | [OK] Verified | `MYRAA-Setup-9.6.3.exe /S` installed (exit 0) over the broken build; installed version 9.6.3.0; launched MYRAA.exe; `GET /api/health` = ok 9.6.3; debug log shows expanded NODE_PATH + "Main window created" (no recovery screen) |
| Installed-app endpoints | [OK] Verified | `/api/action-receipts/status` ok, `/api/step-watcher/status` ok, `/api/mcp/presets` = 8 |
| Packaged asar-only smoke | [OK] Verified | Backend launched with `ELECTRON_RUN_AS_NODE=1` and NODE_PATH pointing only at the packaged asar (no repo modules) -> health 9.6.3 |
| Test suites | [OK] Verified | 28 `tests/test_*.cjs` suites exit 0 (378 checks across 13 suites + auxiliary) |
| End-to-end verifier | [OK] Verified | `tests/verify_final_system.cjs`: dynamic version/paths, isolated port 3011, hash checks - 25 PASS / 0 FAIL |
| MCP | [OK] Verified | Real stdio transport, 8 presets incl `rea` (207 real tools), 60s probe / 90s call timeouts |
| Hash integrity | [OK] Verified | Source == pack SHA256 re-verified by `phase14_release_pack.ps1` |

## 2. Installer locations

1. **Desktop:** `C:\Users\Vishwajeet\Desktop\MYRAA-Installers-v9.6.3\`
2. **Workspace pack:** `C:\Users\Vishwajeet\Music\Myraa\Installers\v9.6.3\`
3. **Build output:** `C:\Users\Vishwajeet\Music\Myraa\resources\app\dist-release\`
4. **Published release:** v9.6.3 at `https://github.com/Vishwajeetsrk/Myraa/releases/tag/v9.6.3` (Setup, Portable, latest.yml, blockmap; id 449659588); v9.6.2 and earlier remain as previous releases

## 3. SHA256 integrity

```
602C55103AD23DE842E8912011B79C4DB0FD30883FE31D8D2CC5F55315FE85B3  MYRAA-Setup-9.6.3.exe
FA04FE7E5D07D74E3AB1BC8201A3A7B6B072E99997775A728F4C744AD36DE172  MYRAA-Portable-9.6.3.exe
```

## 4. Remaining limitations

1. EV code signing absent: SmartScreen warning on first launch until accepted.
2. Electron fuses still in default/weak state (REA-measured); do not flip `RunAsNode` - backend spawn uses it.
3. MCP http transport pending; observability UI not wired (receipt/step events available as backend seam).
4. No durable job queue / global WebSocket broadcast; no nightly CI runner.
5. Shipped React app source not in repo; source recovery needs Linux x64 (`prlimit` + Wakaru), unavailable here.

## 5. Next plan

1. **[DONE]** Packaged startup fixed and verified by real silent install + launch.
2. **[DONE]** Phase 29 modules (action receipts, step watcher, response tags) shipped in the installer.
3. **[DONE]** GitHub Release v9.6.3 published: Setup + Portable + latest.yml + blockmap (id 449659588, all state=uploaded).
4. **[PENDING]** Observability UI, http MCP transport, fuse hardening, nightly CI, shipped React source recovery.

---
Copyright (c) 2026 Vishwajeet & Open Source Contributors - MIT License.
