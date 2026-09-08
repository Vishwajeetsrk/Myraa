# INSTALLER IMPLEMENTATION PLAN — MYRAA AI OS

> Incremental, additive, identity-preserving. Based on `docs/INSTALLER_ARCHITECTURE_AUDIT.md`.

## Phases

### Phase A — Version single source (DONE this pass)
- `scripts/version.cjs` — bump/sync (`version`, `version:sync`, `version:patch|minor|major`).
- Consumers synced: `package.json`, `Cargo.toml`, `tauri.conf.json`, `nsis-installer.nsh`, `VERSION.md`.
- `scripts/release.cjs prepare` → `CHANGELOG.md` stamp.
- Docs: `VERSION_SYSTEM.md`, `RELEASE_GUIDE.md`, `BUILD_COMMANDS.md`.

### Phase B — Updater (DONE this pass)
- `resources/app/electron/updater.cjs` — `electron-updater` (already a dep) wired: safe defaults, IPC + state events.
- Preload exposes `window.myraaUpdate` (`check/download/install/subscribe/state`).
- `main.cjs` calls `updater.scheduleStartupCheck()` on window create (silent).
- Legacy `autoUpdateEngine.cjs`: root now resolved from runtime (no more `D:\` hardcode); **still unmounted** for safety.
- Docs: `UPDATE_SYSTEM.md`.

### Phase C — Identity + appId (DONE this pass)
- `electron-builder.v2.yml` appId → `com.myraa.desktop` (was legacy `com.jarvis.*`).
- `electron-builder.yml` flagged **DEPRECATED**.
- Icon source of truth `Myraa.png` → `scripts/generate-icons.ps1` regenerated:
  Tauri `icons/`, Electron `build/icon.png|ico`, installer assets `docs/installer/`.

### Phase D — CI/CD (DONE this pass)
- `.github/workflows/release.yml` — `v*` tag → validate → win/mac/linux builds → checksums → GH Release.
- Note: requires `npm ci` working in CI (lockfile present).

### Phase E — Branded NSIS wizard (NEXT)
- Move from stock electron-builder NSIS to custom MUI2 pages via `build/nsis-installer.nsh`:
  - Welcome (`MUI_PAGE_WELCOME`) with installer bitmap + logo + version.
  - License (EULA text file, scrollable, must accept).
  - Directory (already `allowToChangeInstallationDirectory: true`).
  - Components (Start Menu shortcut / Desktop shortcut / Launch after install).
  - InstFiles (real progress stages).
  - Finish page (`MUI_FINISHPAGE_RUN` = launch MYRAA).
- EULA asset: `resources/app/build/EULA.txt`.
- Version footer auto-injected by `scripts/version.cjs`.

### Phase F — About / Update UI (NEXT)
- Reuse existing Settings infra; add "About MYRAA" panel powered by `myraaUpdate.state()` + `myraa` bridge (`appVersion`, platform).
- Show: logo, version, build#, platform, architecture, Installation ID (hash of MachineGuid).
- Buttons: Check for Updates / View Release Notes (opens CHANGELOG or GH releases) / Copy System Info.
- Wire the existing "APEX Update Center" UI to real endpoints (`/api/update/status`) once server routes are mounted safely.

### Phase G — Update Center backend (NEXT, guarded)
- Mount safe read-only routes in `server.cjs`/new route file: `GET /api/update/status` (version from package), `POST /api/update/check` (delegates to electron-updater via IPC if available; otherwise 501).
- Do NOT mount `autoUpdateEngine` write pipeline (`/api/update/run`) until it is re-architected with: source allow-list, SHA256 manifest, signature check, dry-run default.

### Phase H — MSI / store / mac / linux polish (LATER)
- Windows: WiX MSI (Tauri bundle has wix target) or electron-builder `msi` target.
- macOS: `.icns` via `iconutil` on macOS runner; notarization placeholders (`entitlements.mac.plist` exists).
- Linux: Flatpak manifest; AppImage runtime dependency sync.

## Identity & data invariants (never violated)

- `Nai.vrm` avatar (16,362,128 bytes) — untouched.
- MYRAA voice, personality, UI, modules — untouched.
- `%APPDATA%\MYRAA` (memory DB, vault, settings) — preserved (`deleteAppDataOnUninstall:false` + per-user data dir).

## Definition of Done (per phase)

UI (if applicable) + backend wiring + version metadata + checks + identity guard PASS + doc updated.