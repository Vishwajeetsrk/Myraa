# MYRAA AI OS — Installer & Update System Architecture Audit

**Date:** 2026-09-08 · **Auditor:** opencode (v7.5.0 lineage) · **Project root:** `C:\Users\Vishwajeet\Music\Myraa`

> Purpose: Phase-1 gate for the Installer & Update System. Nothing below was modified — this is a read-only audit.

---

## 1. CURRENT ARCHITECTURE

**Shipping desktop stack (active):**
- **Electron 31** — `resources/app/electron/main.cjs` is the real entrypoint (`package.json main`). It spawns the Node backend (`dist/server.cjs`, Express on `:3000`) as a child process via `ELECTRON_RUN_AS_NODE`, shows a custom `splash.html`, then loads `http://localhost:3000`.
- **Packaging:** `electron-builder` v25 (`electron-builder.v2.yml` active, `electron-builder.yml` duplicate). NSIS Windows installer, DMG/zip macOS, AppImage/deb/rpm Linux. Custom C# launcher swap via `afterPack.cjs` + `build/MYRAA-launcher.exe`.
- **Frontend:** Compiled React/Vite bundle `dist/assets/index-qnLjC2CG.js` plus additive legacy UI layers `dist/myraa_v6_app.js`, `dist/myraa_hud.js`, `dist/ui-health-patch.js`, `dist/universal-control-addon.js`, `dist/tauri-bridge.js`.
- **Backend:** `dist/server.cjs` serves the app + Express API; `/api/plugins`, `/api/vault`, `/api/system/*`, etc. Also `dist/apex_v5_routes.cjs`, `dist/myraa_v6_real_routes.cjs`.

**Parallel shell (secondary, partially migrated):**
- **Tauri 2** — `src-tauri/` exists with `MYRAA AI OS © 1.0.2`, identifier `com.myraa.desktop`, tray, updater plugin, NSIS/WiX bundle targets. `BUILD_STATUS.md` describes a "native shell migration" but the active runtime today is Electron (`resources/app` scripts are the live ones; root also holds a loose Electron unpacked tree: `MYRAA.exe`, dlls, `resources.pak`).

**Result:** dual-framework landscape — Electron (active) and Tauri (aspirational/parallel). Duplication risk is high.

---

## 2. EXISTING VERSION SYSTEM

**Fragmented — at least 6 independent version carriers:**

| Source | Version | Notes |
|---|---|---|
| `resources/app/package.json` | `7.5.0` | Deserialized by updaters |
| `src-tauri/tauri.conf.json` | `1.0.2` | Tauri shell |
| `src-tauri/Cargo.toml` | `1.0.2` | Tauri crate |
| `resources/app/version_history.txt` | `v1.0` | Empty stub ("Introduction drafted") |
| `INSTALLER_STATUS.md` | `v6.2.0 APEX` | Release narrative |
| UI brand badge (`myraa_v6_app.js`) | `v6.0 APEX` | Hardcoded string |
| `build/nsis-installer.nsh` | `1.0.2` | Hardcoded string |

**Problems:**
1. No single source of truth.
2. UI/installer/updater/package.json disagree (7.5.0 vs 1.0.2 vs 6.2.0 vs 6.0).
3. `autoUpdateEngine.cjs` reads version from a **stale hardcoded path** (`D:\Team of Vishwajeet\MYRAA`).
4. No `CHANGELOG.md`, no `VERSION.md`, no build-number metadata.

---

## 3. EXISTING BUILD SYSTEM

**Electron (active):**
- `npm run dist:win|mac|linux|all` → `electron-builder --config electron-builder.v2.yml --publish never`.
- Output dir `resources/app/release` (does not exist yet this session).
- Windows: NSIS + portable (x64). macOS: dmg + zip (x64/arm64). Linux: AppImage + deb + rpm (x64).
- `files` includes `dist/**`, `electron/**`, `package.json`. Bounded by `!src/**`, `!*.map`, `!release/**`.

**Tauri (parallel):**
- `npm run tauri:build`; `src-tauri/tauri.conf.json` bundle targets `all` → NSIS/WiX (Windows), dmg (macOS), deb/rpm/AppImage (Linux).

**CI/CD:** None. No `.github/workflows`, no `release.yml`, no checksums pipeline.

---

## 4. DESKTOP FRAMEWORK

**Electron 31 (primary).** Custom bridge via `preload.cjs` (`window.myraaDesktop`). Splash + main window + tray-adjacent behavior, single-instance lock, screen capture for vision, native GPU switches for the 3D avatar. `electron-updater` v6.3.9 is installed in `node_modules` and declared in `dependencies` but **never imported** — no `autoUpdater` usage in `main.cjs` or `preload.cjs`.

**Tauri 2 (secondary).** Rust shell with many `tauri-plugin-*` deps including `updater`, but `tauri.conf.json` updater `pubkey` is **empty** and `endpoints` point at `https://github.com/vishwajeetsrk/JARVIS-AI-OS/releases/latest/download/latest.json` (no such manifest is published today) — the Tauri updater path is non-functional as configured.

---

## 5. INSTALLER TECHNOLOGY

**Active:** electron-builder NSIS (Windows), assisted installer:
- `oneClick: false` · `allowToChangeInstallationDirectory: true` · desktop + start-menu shortcuts · `deleteAppDataOnUninstall: false` (**correct** — preserves user data).
- Icon set in `build/` (`icon.ico`, `icon.png`), plus legacy `public/icon.ico` reference in the stale `electron-builder.yml`.
- `build/nsis-installer.nsh` is a no-op stub — the `include:` hook exists but does nothing useful.
- `afterPack.cjs` swaps the stock exe for a custom C# launcher (`build/MYRAA-launcher.exe`, source `Installers/MYRAA-Upgrade-Installer.cs` pattern).

**Legacy (superseded but present):** `Installers/` holds v5–6.x BAT/VBS/C# manual installers (`Install-Myraa.bat`, `install_myraa.vbs`, `MYRAA-Upgrade-Installer.cs`, `MYRAA-Upgrade-Setup.exe`, etc.) and `INSTALLERS_MANIFEST.md`. These target old location `C:\Users\Vishwajeet\Music\Mira` / `D:\Team of Vishwajeet`.

**Root pollution:** the repo root contains an unpacked Electron runtime (`MYRAA.exe`, `MYRAA-runtime.exe`, `MYRAA-Setup.exe`, dlls, `chromium` paks, `ffmpeg.dll` ...) — not git-managed cleanly, merge/version ambiguity.

---

## 6. DATABASE IMPACT

- **SQLite** memory DB: `%APPDATA%\MYRAA\memory\myraa_memory.db` (rusqlite bundled). Plus `teach_drafts.json`, `teach_procedure`, sessions.
- **Vault:** `%APPDATA%\MYRAA\settings\vault_meta.json` (metadata only, no secrets) + `%APPDATA%\MYRAA\settings\vault_secrets.enc` (AES-256-GCM). Windows Credential Manager (keyring) also used (`com.myraa.desktop`).
- Legacy plaintext `%APPDATA%\JARVIS\vault.json` — `secure_vault.cjs` migrates/scubs it on startup.
- **Data must survive reinstall/upgrade.** `deleteAppDataOnUninstall: false` already protects %APPDATA%; NSIS `allowToChangeInstallationDirectory` must keep the per-user data split (app in install dir, data in `%APPDATA%\MYRAA`). The Electron `main.cjs` genesis already sets `MYRAA_DATA_DIR=app.getPath('userData')`.

---

## 7. SECURITY RISKS

1. **Updater medal empty / unsigned** — Tauri updater `pubkey: ""`; electron-updater not wired to verify signatures. High.
2. **Legacy plaintext vault paths** (`%APPDATA%\JARVIS\vault.json`, root `secrets.json`) — auto-migrated, must verify scrub. Medium.
3. **Hardcoded secrets in repo surface** — `resources/app/.env`, `secrets.json` at root (⚠ needs staleness review, not logged).
4. **`autoUpdateEngine.cjs` wipes caches and runs raw `xcopy`/`taskkill` from an arbitrary `buildDir`** — would execute anything passed to `/api/update/run`. Currently unmounted (inert), but if mounted it is RCE-by-design. High if reused.
5. **Update download validation** — no SHA256/publisher checks anywhere today. High.
6. **CORS `*` on the SSE update stream** in `autoUpdateEngine.cjs` — low while offline-only, medium if exposed.
7. **No code-signing config** for NSIS/electron-builder (no cert configured). Medium.

---

## 8. PERFORMANCE BOTTLENECKS

- Splash→backend boot→`localhost:3000` chain serializes startup (`waitForBackend` 40s timeout).
- Three stacked UI layers (`index bundle` + `myraa_v6_app.js` + patches) over one DOM — main-thread jank risk.
- 2.1 MB `Myraa.png` source logo; icon pack not normalized per platform, Tauri icon set separate from electron set → duplicated asset tree.
- Full-repo copy installers (`xcopy` of everything incl. `node_modules`).

---

## 9. UI/UX PROBLEMS (installer & update domain)

- No `Settings → About MYRAA` screen in shipped UI; version tag hardcoded `v6.0 APEX`.
- `ui-health-patch.js` claims an "APEX Master Update Center connected to `/api/update/*`" — **backend does not mount those routes** (`server.cjs` has no `attachUpdateRoutes`), so the Update Center UI is non-functional today.
- No installation wizard, no EULA, no completion screen, no progress stages tied to real ops.
- Existing NSIS is the stock electron-builder UI — unbranded.

---

## 10. ARCHITECTURE PROBLEMS

1. Dual desktop frameworks racing (Electron active vs Tauri narrative) — one shell must be authoritative.
2. Version truth scattered (7 files).
3. Update systems triplicated: electron-updater (unwired), autoUpdateEngine (unmounted, broken root), Tauri updater (empty key, dead endpoint).
4. `autoUpdateEngine.cjs` hardcodes `D:\Team of Vishwajeet\MYRAA` — dead on this machine's real root `C:\Users\Vishwajeet\Music\Myraa`.
5. Stale duplicate `electron-builder.yml` vs `.v2.yml`.
6. No CI/CD release pipeline; GitHub releases absent.
7. appId inconsistency: electron-builder uses `com.jarvis.myraa-ai-os` (legacy JARVIS id) while Windows uses `com.myraa.desktop` and Tauri uses `com.myraa.desktop` — identity collision.

---

## 11. PRIORITY FIXES

| # | Fix | Impact | Effort |
|---|---|---|---|
| P0 | Single source of truth for version + auto-sync (package.json → tauri.conf/Cargo/VERSION.md/CHANGELOG/UI) | kills fragmentation | S |
| P0 | Fix `autoUpdateEngine` root resolution to be env/relative; keep unmounted until hardened | unblocks update path | S |
| P0 | Wire `electron-updater` (already installed) with publish provider `vishwajeetsrk/JARVIS-AI-OS` + integrity/rollback handling | real auto-update | M |
| P0 | Align appId to `com.myraa.desktop` in electron-builder config; decommission stale `electron-builder.yml` | identity | S |
| P1 | Mount real `/api/update/*` (status/check/dry-run) so Update Center UI works | closes fake-UI gap | M |
| P1 | Branded NSIS installer (welcome/license/location/progress/completion), icons from `Myraa.png`, EULA, version footer | installer UX | M |
| P1 | `scripts/version.cjs` (patch/minor/major) + `scripts/release.cjs` (changelog, tag-prep, checksum) | release ops | M |
| P1 | `.github/workflows/release.yml` (tag `v*` → build artifacts, checksums, GitHub Release) | CI/CD | M |
| P2 | About screen + update-check in UI (reuse existing Settings infra) | UX | M |
| P2 | Icon generation pipeline from single source `Myraa.png` → ico/png/icns all platforms | assets | S |
| P2 | Update history store (SQLite or JSON), install log `logs/install.log` sanitized | observability | S |

---

## 12. MIGRATION STRATEGY

1. **This pass (implement):**
   - `scripts/version.cjs` + `scripts/release.cjs` (single version source = `resources/app/package.json`; generates `VERSION.md`, syncs `Cargo.toml`, `tauri.conf.json`, writes `CHANGELOG.md` stub, `docs/*` markdown).
   - Fix `autoUpdateEngine.cjs` root resolution (env-relative, guarded, still unmounted).
   - Wire `electron-updater` in `main.cjs` (startup check, manual `checkForUpdates`, IPC to preload/UI `myraa:update:*`), publish provider already correct in electron-builder.v2.yml.
   - Align appId `com.myraa.desktop`; mark `electron-builder.yml` stale.
   - `.github/workflows/release.yml` + `BUILD_COMMANDS.md`, `RELEASE_GUIDE.md`, `UPDATE_SYSTEM.md`, `VERSION_SYSTEM.md`, `INSTALLER_IMPLEMENTATION_PLAN.md`.
   - Icon pipeline script + regenerate icon set from `C:\Users\Vishwajeet\Music\Myraa.png` into `build/` and `src-tauri/icons/`.
2. **Next pass:** branded NSIS wizard (EULA + location + progress + finish), About UI, real Update Center endpoints, install-log, checksum manifest `checksums.txt`.
3. **Later:** decide canonical shell (Electron vs Tauri) with user; harden updater signing; macOS notarization placeholders; Windows store/MSI via WiX; Flatpak.

**Guiding rule (user directive):** identity (MYRAA name, `Nai.vrm` avatar model, voice, personality, UI, modules) is NEVER touched. Only installer/version/update/packaging infrastructure around the existing runtime.