# MYRAA AI OS v9.6.2 - Production Installer Status & Test Report

Built: 2026-11-18 · Config: `electron-builder.v2.yml` (NSIS + portable, x64, unsigned)

> v9.6.2 adds the Phase 29 P1 slice on top of v9.6.1: verifiable action receipts, settle-aware step
> watcher, model-only typed response tags (all mounted under `/api/...`), plus the earlier REA
> preset, MCP timeout fix, WCAG AA design pass, animated shadcn bell and modernized verifier.
> GitHub Release **v9.6.1 is live**; v9.6.2 is packed locally and not published yet.

## 1. Verification summary

| Component | Status | Verification details |
|-----------|--------|----------------------|
| Core Express backend | [OK] Verified | Boots on 3000 (LAN/mobile), all phase mounts log clean; Phase 29 mount line present; permissions + MCP 6 agi tools |
| Test suites | [OK] Verified | 28 `tests/test_*.cjs` suites exit 0 (documented battery 378 checks across 13 suites + auxiliary); Phase 29 adds 60 checks |
| End-to-end verifier | [OK] Verified | `tests/verify_final_system.cjs`: dynamic version/paths, isolated port 3011, capability preservation, installer hash check - **23 PASS / 0 FAIL / 1 SKIPPED** (skip = external chat provider slow) |
| MCP | [OK] Verified | Real stdio transport; 8 presets incl `rea` (207 real tools); timeout fix shipped (60s probe / 90s call); http transport honest `NOT_IMPLEMENTED` |
| Packaged app bundle | [OK] Verified | `version.json` = 9.6.2; `action_receipts.cjs`, `step_watcher.cjs`, `response_tags.cjs` present and mounted; packaged server on 3005: health 9.6.2, receipt start redacted (`[REDACTED]`), step-watcher status OK, tag parse `POINT,DO`, 8 presets incl rea |
| Hash integrity | [OK] Verified | Source == pack SHA256 re-verified by `phase14_release_pack.ps1` after copy |
| UI / a11y | [OK] Verified | 19 WCAG token pairs pass AA; animated bell wired and built; bundle 557 KB -> 436 KB |

## 2. Installer locations

1. **Desktop:** `C:\Users\Vishwajeet\Desktop\MYRAA-Installers-v9.6.2\`
   - `MYRAA-Setup-9.6.2.exe` (291.8 MB, NSIS x64)
   - `MYRAA-Portable-9.6.2.exe` (285.9 MB)
2. **Workspace pack:** `C:\Users\Vishwajeet\Music\Myraa\Installers\v9.6.2\`
   - exes + `MYRAA-Install-v9.6.2.bat` + `SHA256SUMS.txt` + `checksums.txt` + `README.txt`
3. **Build output:** `C:\Users\Vishwajeet\Music\Myraa\resources\app\dist-release\`
   - exes, `latest.yml`, blockmap, `win-unpacked\`
4. **Published releases:** v9.6.1 (`https://github.com/Vishwajeetsrk/Myraa/releases/tag/v9.6.1`) and v9.5.0; v9.6.2 not published yet

## 3. SHA256 integrity

```
C3CD398811AC6DE3EE76892A61A27102E5A30117A04597314FA306352D14459A  MYRAA-Setup-9.6.2.exe
A15ED4D829E05C312990C9821670C61B238038094379592784080F3DC2714983  MYRAA-Portable-9.6.2.exe
```

## 4. Architecture: working / missing / next

### [A] Working
1. Autonomous operations stack + MCP real stdio (8 presets incl REA, 207 real tools).
2. Phase 29 patterns from plip-oss: action receipts (redacted, append-only, undo tokens), step watcher, model-only tag parser - live in the packaged app.
3. Release pipeline reproducible: `npm run dist:win` -> `phase14_release_pack.ps1` -> versioned pack + Desktop copy + hashes.
4. Global skills installed and registered in `docs/skills/REGISTRY.md` (GSD Core 72, replica 11, Roo 3, Ralph, REA).

### [B] Limitations
1. EV code signing absent: SmartScreen warning on first launch until accepted.
2. Electron fuses are in default/weak state (REA-measured); do not flip `RunAsNode` - backend spawn uses `ELECTRON_RUN_AS_NODE`.
3. MCP http transport pending; observability UI (timeline/event surfaces) not wired (step-watcher events are available as the backend seam).
4. No durable job queue / global WebSocket broadcast; no nightly CI runner.
5. Shipped React app source not in repo; REA source recovery needs Linux x64 (`prlimit` + Wakaru), unavailable here.
6. Unsigned binaries are large; GitHub Releases (not repo commits) are the only publish path.

### [C] Next plan
1. **[DONE]** v9.6.2 built, packed, hash-verified; packaged smoke: health, Phase 29 APIs, 8 presets, tag parse.
2. **[DONE]** Phase 29 P1 slice (60 checks) + 28 suites green; verifier 23 PASS / 0 FAIL.
3. **[PENDING]** Publish GitHub Release v9.6.2 (Setup + Portable + latest.yml + blockmap).
4. **[PENDING]** Observability UI over step/receipt events; http MCP transport; fuse hardening; nightly CI; shipped React source recovery (needs Linux worker or original source).

---
Copyright (c) 2026 Vishwajeet & Open Source Contributors - MIT License.
