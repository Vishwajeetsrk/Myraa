# MYRAA Single-EXE Release Runbook — all updates, one installer

Goal: one `MYRAA-Setup-<version>.exe`, easy to install and use, containing
Phases 1-12 (security, Course Studio, panels, PDF/OCR, awareness, learning,
compute, intents, docs, tutor, compute batch, pointer, UX upgrade).

## Step 0 — Preconditions
- Windows 10/11, Node 20+, Python 3.10+, Electron build deps (`npm install` once in `resources/app`).
- Kaggle CLI optional: `pip install kaggle` + `kaggle auth login` (only for the compute worker path).
- Git working tree clean except intended changes (commit or stash first).

## Step 1 — Apply all phases (as you, PowerShell)
```powershell
$s = 'C:\Users\Vishwajeet\AppData\Local\Temp\opencode'
$scripts = @('phase1_security_patches.ps1','phase2_vertical_slice.ps1','phase3_panel.ps1','phase4_pdf_ocr.ps1','phase5_awareness.ps1','phase6_learn.ps1','phase7_compute.ps1','phase7c_intents.ps1','phase8_docs.ps1','phase9_tutor.ps1','phase10_tutor_batch.ps1','phase11_pointer.ps1','phase12_ux.ps1')
foreach ($f in $scripts) { powershell -ExecutionPolicy Bypass -File (Join-Path $s $f); if ($LASTEXITCODE -ne 0) { throw "FAILED: $f" } }
```
Each script backs up, self-tests, and is idempotent (safe re-run).

## Step 2 — Verify (app running)
Walk `docs\myraa-audit\RELEASE_CHECKLIST.md` top to bottom:
- consent 403 flow, outline job transitions, lesson narration voice, quiz->review queue
- worker heartbeat online, KAGGLE submit -> outbox, intent routing incl. regressions
- pointer session/point/action guardrails, notes stop, pairing verify
- UX: skeleton shimmer on slow views, nav groups collapse, settings tabs, Alt+number nav

## Step 3 — Version bump (new features = minor)
```powershell
cd C:\Users\Vishwajeet\Music\Myraa\resources\app
npm run version:minor
```
9.3.1 -> 9.4.0 across `version.json` + `package.json`. Never hand-edit versions.

## Step 4 — Build the single exe
```powershell
cd C:\Users\Vishwajeet\Music\Myraa\resources\app
npm run dist:win
```
Output: `release\` / `Installers\v9.4.0\MYRAA-Setup-9.4.0.exe`.
Signed release instead: `npm run build:release`. Validate: `npm run release:validated` + `npm run test:installer`.

## Step 5 — Ship
- Copy the exe + SHA256SUMS to the release folder (see `Installers\v9.3.1\README.txt` pattern).
- Rollback: `*.bak_phase*` files restore any patched file; delete staged new files per each script's footer.
