# Version

**Current Version:** 7.5.0
**Build:** 20260908.1

## Release Strategy

Semantic Versioning (MAJOR.MINOR.PATCH)

- **MAJOR** — breaking architecture changes (e.g., 2.0.0 shell decision)
- **MINOR** — new features and capabilities (e.g., 1.1.0 agents + plugins)
- **PATCH** — bug fixes and improvements (e.g., 1.1.1)

## Update Channels

- **Stable** — production-ready releases (default)
- **Beta** — new features before stable
- **Development** — internal testing

## Release Process

1. Development
2. Testing
3. Version bump  — `npm run version:patch|minor|major`
4. Changelog update  — `npm run release:prepare`
5. Build  — `npm run dist:win|mac|linux|all`
6. GitHub Release  — tag `v*.*.*`, workflow `.github/workflows/release.yml`
7. Auto-update distribution  — electron-updater reads GitHub Releases (provider: vishwajeetsrk/JARVIS-AI-OS)

## Build Metadata

Generated: 2026-09-08T11:53:22.407Z
