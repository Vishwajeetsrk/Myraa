# RELEASE GUIDE — MYRAA AI OS

## One-line

```
npm run version:patch && npm run release:prepare && npm run dist:win && git tag v<ver> && git push origin v<ver>
```

## Step-by-step

1. **Bump version**
   `npm --prefix resources/app run version:minor` (or `:patch` / `:major`)
   → syncs `package.json`, `Cargo.toml`, `tauri.conf.json`, `nsis-installer.nsh`, `VERSION.md`.

2. **Prepare release**
   `npm --prefix resources/app run release:prepare`
   → stamps `CHANGELOG.md` `## [x.y.z] - YYYY-MM-DD`; edit the Added/Improved/Fixed/Security bullets.

3. **Build installers**
   `npm --prefix resources/app run dist:win` (or `:mac` / `:linux` / `:all`)
   → artifacts land in `resources/app/release/`.

4. **Checksums + manifest**
   `node scripts/release.cjs checksums`
   → writes `checksums.txt` in the release dir.
   `node scripts/release.cjs latest` → writes `latest.json` (updater manifest).

5. **Commit + tag**
   ```
   git add -A
   git commit -m "chore: release v7.5.0"
   git tag v7.5.0
   git push origin v7.5.0
   ```

6. **CI (`.github/workflows/release.yml`)**
   On tag `v*` → lint/validate → build Windows/macOS/Linux → checksums →
   GitHub Release with assets (`MYRAA-Setup-*.exe`, `.msi`-capable via WiX (Tauri),
   `.dmg`, `.AppImage`, `.deb`, `.rpm`).

## Identity / Data guarantees

- The avatar `Nai.vrm`, MYRAA voice, personality, UI, modules, and database are never
  touched by release tooling.
- NSIS `deleteAppDataOnUninstall: false` → user data (SQLite memory, vault, settings)
  survives reinstall/upgrade.