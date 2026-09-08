# RELEASE — MYRAA AI OS

Channels: Stable (default), Beta, Development.

Current: `7.5.0` — see `VERSION.md` for authoritative current version.

## Artifacts (target matrix)

| Platform | Target | Arch | Artifact |
|---|---|---|---|
| Windows | NSIS .exe | x64 | `MYRAA-Setup-<ver>.exe` |
| Windows | portable .exe | x64 | `MYRAA-Setup-<ver>.exe` (portable flavor) |
| Windows | MSI (future / Tauri WiX) | x64 | `MYRAA-<ver>-x64.msi` |
| macOS | dmg | x64, arm64 | `MYRAA-AI-OS-<ver>-mac.dmg` |
| macOS | zip (update) | x64, arm64 | `MYRAA-AI-OS-<ver>-mac.zip` |
| Linux | AppImage | x64 | `MYRAA-AI-OS-<ver>.AppImage` |
| Linux | deb | x64 | `MYRAA-AI-OS-<ver>.deb` |
| Linux | rpm | x64 | `MYRAA-AI-OS-<ver>.rpm` |
| All | checksums | — | `checksums.txt`, `latest.yml`, `latest.json` |

## Publishing flow

1. `npm --prefix resources/app run version:patch|minor|major`
2. `npm --prefix resources/app run release:prepare` → edit `CHANGELOG.md`
3. `npm --prefix resources/app run dist:<os>` → artifacts in `resources/app/release/`
4. `node scripts/release.cjs checksums` + `node scripts/release.cjs latest`
5. Commit, tag `v<ver>`, push → `.github/workflows/release.yml` publishes GH Release.

## Repository

GitHub: `https://github.com/vishwajeetsrk/JARVIS-AI-OS`
Updater provider: owner `vishwajeetsrk`, repo `JARVIS-AI-OS` (electron-builder.v2.yml).