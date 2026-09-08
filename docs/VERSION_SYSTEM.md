# VERSION SYSTEM — MYRAA AI OS

## Single Source of Truth

**`resources/app/package.json` → `version`** is the ONLY manually-edited version field.

All other version carriers are **auto-synced** by `scripts/version.cjs`:

| Consumer | File | Sync |
|---|---|---|
| Electron bundle | `resources/app/package.json` | source |
| Tauri shell | `src-tauri/tauri.conf.json` → `.version` | auto |
| Tauri crate | `src-tauri/Cargo.toml` → `[package] version` | auto |
| Installer stub | `resources/app/build/nsis-installer.nsh` | auto |
| Version doc | `VERSION.md` | auto |
| Build number | generated `YYYYMMDD.1` | auto |

## Commands

| Command | Effect |
|---|---|
| `npm run version:` | print current + re-sync consumers (no bump) |
| `npm run version:sync` | re-sync consumers without bumping |
| `npm run version:patch` | `7.5.0 → 7.5.1` |
| `npm run version:minor` | `7.5.1 → 7.6.0` |
| `npm run version:major` | `7.6.0 → 8.0.0` |
| `node scripts/version.cjs 1.2.3` | explicit version |
| `npm run release:prepare` | stamp CHANGELOG + print next steps |

## Semantic Versioning

- **MAJOR** — breaking architecture changes (e.g., canonical shell decision)
- **MINOR** — new features / capabilities
- **PATCH** — bug fixes / improvements

## Build Metadata

`Build YYYYMMDD.1` is generated on demand (date + sequence). Shown in `VERSION.md`,
installer footer, and available to the About screen via the updater module.

## About Display Target

```
MYRAA AI OS
Your Personal AI Operating System
Version X.Y.Z
Build YYYYMMDD.N
Platform: Windows
Architecture: x64
```