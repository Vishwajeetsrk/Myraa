# Changelog

All notable changes to MYRAA AI OS are documented here.

## [9.5.0] - 2026-10-18

### Added
- **MCP stdio transport (Phase 25):** the MCP registry is now real for stdio servers - `initialize` handshake, `tools/list` caching, and approval-gated `tools/call` via a minimal newline-delimited JSON-RPC client (`mcp_stdio_client.cjs`); process trees are killed on Windows with `taskkill /T /F`. New HTTP `POST /api/mcp/call` and `GET /api/mcp/servers/:name/tools`; new agi tools `mcp_probe` (MEDIUM) and `mcp_call` (HIGH, approval-gated); new voice intent "probe mcp `<name>`". The http transport stays honest with `NOT_IMPLEMENTED`.
- **Curated real-server presets:** `GET /api/mcp/presets` / `POST /api/mcp/presets/add` add official MCP servers (filesystem, memory, everything, git, fetch, time, sqlite) in one call; `npx` presets need Node 18+, `uvx` presets need uv.
- `tests/test_mcp_transport.cjs` - 31 checks (registry, validation, presets, honest errors; nothing is spawned in the default run). The transport itself is verified live against the official `server-everything` with `MYRAA_MCP_LIVE=1` - no fake server fixtures ship in the repo.

### Changed
- `mcp_manager.cjs`: `probe` is now async with honest error codes (`TIMEOUT`, `SERVER_EXITED`, `SPAWN_ERROR`, `RPC_ERROR`, `DISABLED`, `NOT_IMPLEMENTED`); server views/status expose per-transport `implemented` flags and cached tool counts.

### Installers
- `MYRAA-Setup-9.5.0.exe` (308.9 MB, NSIS x64) and `MYRAA-Portable-9.5.0.exe` (303.0 MB) built, hash-verified, packed to `Installers\v9.5.0` + Desktop copy. Packaged bundle live-verified: real MCP probe of `server-everything` (13 tools) + real `tools/call` (`get-sum` -> "The sum of 20 and 22 is 42.").
- Real Windows install verified: silent setup install to `%LOCALAPPDATA%\Programs\MYRAA` (shortcuts + uninstaller registered), installed-runtime smoke passed (health 9.5.0, 7 presets, real probe + real `get-sum` via the installed Electron binary), app window launched from the installed EXE.
- GitHub Release `v9.5.0` published with 4 assets: Setup, Portable, `latest.yml`, Setup blockmap (`https://github.com/Vishwajeetsrk/Myraa/releases/tag/v9.5.0`).

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

### Fixed
- Dist SQLite bridge (`sqlite_memory_bridge.py`): the command dispatch had split into 5 separate if/elif chains, so commands handled by earlier chains printed their success JSON and then the final chain also printed `Unknown command`. Effect: Course Studio create returned HTTP 500 (`bridge returned non-JSON`) even though the row was silently saved, and the course list masked store errors as empty. Memory/compute/pointer commands emitted a spurious second line too. All chains are now a single dispatch (helper defs moved above, later chain starts are `elif`); every command returns exactly one JSON line. Verified live: `POST /api/course-studio/courses` -> 200.

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