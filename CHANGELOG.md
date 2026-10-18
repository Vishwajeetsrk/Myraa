# Changelog

All notable changes to MYRAA AI OS are documented here.

## [9.4.0] - 2026-10-18

### Added
- **Autonomous Operations Stack** (9 governed subsystems, 286 live checks):
  - Evidence Engine — auditable sessions, findings, unknowns with SHA256-hashed evidence and schema-level honesty rules.
  - Investigation Toolkit — PE/ASAR/SQLite/ZIP analyzers, privileged string extraction, crash triage, reconstruction verification.
  - Agent Workspace — named agents, threads, daily/weekly routines with computed `nextRunAt`, approval cards with scopes and expiry.
  - Connector Market — 8 zero-/low-auth tool connectors with declarative host allowlists and honest failure codes (`AUTH_REQUIRED`, `WORKER_OFFLINE`, `REMOTE_ERROR`).
  - Model Gateway — Ollama / OpenAI-compatible / OpenRouter / own-key lanes with token saver and honest `NO_PROVIDER` chains.
  - Action Safety Broker — HIGH/CRITICAL tools execute only after an approval decision; retryable failures; secret-redacted params.
  - Unified Event Bus — append-only JSONL log, namespaced types, payload clamping + redaction, never-throws `emit`.
  - Task Timeline — read-only merge of events, broker bindings, approvals and routines with day-scoped voice summary.
  - Tool Permissions + MCP Registry — per-agent allow/deny policies (deny wins, high-risk needs explicit grant) and an MCP server registry skeleton.
- Voice commands for every subsystem ("activity log", "timeline", "safety broker status", "tool permissions", "allow agent X to use Y", "mcp servers", ...).
- New HTTP surfaces: `/api/evidence/*`, `/api/connector-market/*`, `/api/model-gateway/*`, `/api/events/*`, `/api/timeline/*`, `/api/permissions/*`, `/api/mcp/*`.
- `tests/` — 9 live suites (286 checks) covering all subsystems.
- `docs/` — per-phase integration documentation.

### Changed
- README overhauled for v9.4.0 (capability matrix, Autonomous Operations Stack section, endpoints reference, directory layout).

### Installers
- `MYRAA-Setup-9.4.0.exe` (308.9 MB, NSIS x64) and `MYRAA-Portable-9.4.0.exe` (302.9 MB) built, hash-verified, packed to `Installers\v9.4.0` + Desktop copy.

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