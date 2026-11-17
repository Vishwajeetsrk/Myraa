# MYRAA AI OS v9.6.1 - Production Installer Status & Test Report

Built: 2026-11-17 · Config: `electron-builder.v2.yml` (NSIS + portable, x64, unsigned)

> v9.6.1 ships everything that was unreleased after v9.5.0: REA as the 8th MCP preset
> (real stdio transport, 207 real tools), `MAX_TOOLS` 200 -> 300, MCP probe/call timeouts
> raised to 60s/90s, the WCAG AA design-token pass, the animated shadcn bell in the
> AURELIA dashboard project, and a modernized end-to-end verifier.
> GitHub Release **v9.5.0 is live**; v9.6.1 is packed locally and not published yet.

## 1. Verification summary

| Component | Status | Verification details |
|-----------|--------|----------------------|
| Core Express backend | [OK] Verified | Boots on 3000 (LAN/mobile), all phase mounts log clean; permissions + MCP 6 agi tools |
| Test suites | [OK] Verified | 25 `tests/test_*.cjs` suites exit 0 (documented battery 318 checks across 10 suites + auxiliary); stale investigation skill-count assertion fixed |
| End-to-end verifier | [OK] Verified | `tests/verify_final_system.cjs` modernized: dynamic version/paths, isolated port 3011, capability preservation, installer hash check - **25 PASS / 0 FAIL** (was 7/8 stale failures) |
| MCP | [OK] Verified | Real stdio transport; 8 presets incl `rea`; packaged real probe 207 tools in 13.2s, real `inspect_electron_fuses` tool call SHA256-bound to MYRAA.exe; http transport honest `NOT_IMPLEMENTED` |
| Packaged app bundle | [OK] Verified | `app.asar.unpacked` has `version.json` = 9.6.1, `mcp_stdio_client.cjs`, `mcp_manager.cjs` with `rea` preset + cap 300 + 60s/90s timeouts; packaged server on 3005: health 9.6.1, 8 presets, REA probe/call OK |
| Hash integrity | [OK] Verified | Source == pack SHA256 re-verified by `phase14_release_pack.ps1` after copy |
| UI / a11y | [OK] Verified | 19 WCAG token pairs pass AA (`replica/design/tokens.json` + `contrast.py`); animated bell wired, production build passes; bundle 557 KB -> 436 KB |

## 2. Installer locations

1. **Desktop:** `C:\Users\Vishwajeet\Desktop\MYRAA-Installers-v9.6.1\`
   - `MYRAA-Setup-9.6.1.exe` (291.7 MB, NSIS x64)
   - `MYRAA-Portable-9.6.1.exe` (285.8 MB)
2. **Workspace pack:** `C:\Users\Vishwajeet\Music\Myraa\Installers\v9.6.1\`
   - exes + `MYRAA-Install-v9.6.1.bat` + `SHA256SUMS.txt` + `checksums.txt` + `README.txt`
3. **Build output:** `C:\Users\Vishwajeet\Music\Myraa\resources\app\dist-release\`
   - exes, `latest.yml`, blockmap, `win-unpacked\`
4. **Published release:** v9.5.0 at `https://github.com/Vishwajeetsrk/Myraa/releases/tag/v9.5.0` (v9.6.1 not published yet)

## 3. SHA256 integrity

```
FAD6618FEB8C037D1E3B6D68A9AD9382CFAC0EE09765F884656F4FB0A00FA0A6  MYRAA-Setup-9.6.1.exe
04274307D26875F30CA86A888039E103633C151022B3EA1CB2CE5FE4AFE6580B  MYRAA-Portable-9.6.1.exe
```

## 4. Architecture: working / missing / next

### [A] Working
1. Autonomous operations stack (evidence, investigation, workspace, connectors, model gateway, safety broker, event bus, timeline, permissions) mounted and voice-addressable.
2. MCP is real: stdio handshake, cached tools, approval-gated calls, 8 presets including REA; no fake fixtures.
3. Release pipeline reproducible: `npm run dist:win` -> `phase14_release_pack.ps1` -> versioned pack + Desktop copy + hashes.
4. Global skills installed and registered in `docs/skills/REGISTRY.md`: replica-skill (11), GSD Core (72 + official CLI), Roo Code (3), Ralph loop method, REA MCP.

### [B] Limitations
1. EV code signing absent: SmartScreen warning on first launch until accepted.
2. Electron fuses measured by REA are in default/weak state (RunAsNode on, ASAR integrity off, cookie encryption off). Do not flip `RunAsNode` - the backend spawn uses `ELECTRON_RUN_AS_NODE`.
3. MCP http transport pending; observability UI (timeline/event surfaces) not wired.
4. No durable job queue / global WebSocket broadcast; no nightly CI runner.
5. The shipped React app source is not in the repo. REA's `recover_javascript_sources` requires Linux x64 (`prlimit` + Wakaru) and is unavailable here; the new shadcn bell is in the AURELIA dashboard design project, not the installer UI.
6. Unsigned installers are large; GitHub Releases (not repo commits) are the only publish path for binaries >100 MB.

### [C] Next plan
1. **[DONE]** v9.6.1 built, packed, hash-verified; packaged smoke: health, 8 presets, real REA probe (207 tools) + real tool call.
2. **[DONE]** Verifier modernized (25 PASS / 0 FAIL); stale investigation assertion fixed; MCP timeout fix shipped.
3. **[DONE]** Global skill installs + provenance registry; WCAG AA pass; shadcn bell + perf pass.
4. **[PENDING]** Publish GitHub Release v9.6.1 (Setup + Portable + latest.yml + blockmap) on user go-ahead.
5. **[PENDING]** Recover shipped React source (needs Linux worker or original source); observability UI; http MCP transport; fuse hardening; nightly CI.

---
Copyright (c) 2026 Vishwajeet & Open Source Contributors - MIT License.
