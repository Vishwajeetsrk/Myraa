# Changelog

All notable changes to MYRAA AI OS are documented here.

## [7.5.0] - 2026-09-08

### Added
- Universal API Registry (`packages/api-registry/`) — curated provider registry, scoring, risk policy, health service.
- Connector framework (`MyraaConnector`) with five live adapters: Weather (Open-Meteo), Currency (Frankfurter), Holidays (Nager.Date), News (curated RSS), GitHub REST (read-only, vault token server-side).
- Tool Registry (`myraa.*` tools with READ_ONLY / SAFE_WRITE risk levels and audit events).
- Architecture guard script (`npm run myraa:architecture-check`) that protects MYRAA identity (avatar `Nai.vrm`, voice, modules) and verifies layering.
- Centralized version system (`npm run version:*`) with single source of truth + automatic sync to Cargo.toml / tauri.conf.json / VERSION.md.
- Release orchestrator (`npm run release:prepare`) that stamps CHANGELOG entries and prints the release pipeline.

### Improved
- Live, honest API responses (no fabricated data on failure — `ok:false` with reason).
- Read-only intelligence wired behind the registry; failures never invent values.
- Unified update/installer audit documented in `docs/INSTALLER_ARCHITECTURE_AUDIT.md`.

### Fixed
- Frankfurter FX API host migration (`.app` → `api.frankfurter.dev/v1`) handled via redirect-following connector.
- Nager.Date India 204 (unsupported country) surfaces as an honest message instead of a generic failure.
- Dead Reuters RSS feed removed from the curated news list; replaced with working feeds.

### Security
- Git/GitHub tokens read only from the encrypted SecureVault server-side (`%APPDATA%\MYRAA\settings\vault_secrets.enc`); never frontend.
- Credential vault hardening reviewed; connector design keeps keys off the UI layer.