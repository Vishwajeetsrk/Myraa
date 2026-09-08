# BUILD COMMANDS — MYRAA AI OS

> All commands run from `resources/app` unless noted. `npm` may be blocked by the PS script
> policy on this machine — if so use `node` directly (`node ../scripts/version.cjs`) or
> `npx.cmd`.

## Frontend / UI (prebuilt dist)

| Command | What |
|---|---|
| `npm run dev` | Vite dev server (UI only) |
| `npm run build` | Vite build → `dist/` |
| `npm run preview` | preview build |

## Desktop (Electron — primary shipping)

| Command | What |
|---|---|
| `npm run tauri:dev` | (Tauri alt shell) dev |
| `npm run tauri:build` | (Tauri alt shell) bundle |
| `npm run build:electron` | vite build + electron running against it |
| `npm run dist` | electron-builder all-targets, no publish |
| `npm run dist:win` | Windows NSIS + portable → `release/` |
| `npm run dist:mac` | macOS dmg + zip (x64/arm64) |
| `npm run dist:linux` | AppImage + deb + rpm |
| `npm run dist:all` | win + mac + linux |

## Version / Release

| Command | What |
|---|---|
| `npm run version` / `version:sync` | read + sync version consumers |
| `npm run version:patch` / `:minor` / `:major` | semver bump + sync |
| `npm run release:prepare` | stamp `CHANGELOG.md` |
| `node ../scripts/release.cjs checksums` | `checksums.txt` |
| `node ../scripts/release.cjs latest` | `latest.json` updater manifest |

## Quality

| Command | What |
|---|---|
| `npm run myraa:architecture-check` | identity + layering guard (must PASS) |

## Environment notes

- Icon source of truth: `C:\Users\Vishwajeet\Music\Myraa.png` (2 MB) → generated into
  `resources/app/build/` (electron) and `src-tauri/icons/` (tauri) via `scripts/generate-icons.*`.
- App id: `com.myraa.desktop` (electron-builder.v2.yml). Legacy `electron-builder.yml` is deprecated.
- `autoUpdateEngine.cjs` is present but unmounted; updates go through `electron/updater.cjs`.