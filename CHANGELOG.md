# Changelog

All notable changes to MYRAA AI OS are documented here.

## [Unreleased]

### Added
- Phase 1 verified implementation map (`docs/myraa-audit/CAPABILITY_MAP.md`) and Phase 2 registry design (`CAPABILITY_REGISTRY_PLAN.md`): every subsystem traced to real entry points, storage, API and health state; fake vs real status catalogued.
- Extended `agi/capability_registry.cjs` with the universal status enum, truthful public views (null latency when never measured), live counters and `/public` + `/summary` routes; new `agi/capability_bootstrap.cjs` registers 12 real subsystems with real health checks.
- New `tests/test_capability_registry.cjs` (16 checks).
- Phase 3 `health_manager.cjs`: one aggregate of measured checks (capabilities, AI lanes, MCP, memory DB, OCR, Windows agent, browser runtime, DNS). Every result carries a real status, measured latency and ISO timestamp; mounted at `/api/health-manager`.
- Phase 4 `ai_provider_manager.cjs`: one adapter abstraction over Gemini, Anthropic, OpenRouter, Ollama, OpenAI, Groq. Reuses the existing gateway lanes; honest capability flags and `NOT_IMPLEMENTED` for unwritten adapters; keys never exposed; mounted at `/api/providers`.
- New suites `test_health_manager.cjs` (12) + `test_ai_provider_manager.cjs` (15). Total 421 checks across 16 suites.

### Fixed
- `GET /api/capabilities` no longer returns a hardcoded `REAL`/`verified:true`/`last_tested:now` catalog — it derives from the registry and runs real health checks (live: 12 capabilities, 10 READY, 2 ERROR).
- `/api/agent-health` no longer reports fake `online:true`/`operational`/92 tools; uses the real probe result. `/api/live/status` status now derives from actual WebSocket client count instead of a supervisor field that is never assigned.

## [9.6.3] - 2026-11-18

### Fixed
- Packaged startup: `call-bind-apply-helpers` was packed only under `call-bind/node_modules`, so `dunder-proto` could not resolve it and the backend died with `MODULE_NOT_FOUND` (express -> qs -> side-channel chain). The real fix registers every nested asar `node_modules` directory in the backend's NODE_PATH at launch (`electron/main.cjs`). Verified with an asar-only smoke test, a silent reinstall (exit 0), and a real app launch: health 9.6.3, main window created, Phase 29 endpoints live.
- Published GitHub Release `v9.6.3` with 4 assets (Setup, Portable, latest.yml, blockmap; release id 449659588).

## [9.6.2] - 2026-11-18

### Added
- **Phase 29 - plip-oss patterns implemented** (see `docs/myraa-audit/PLIP_PATTERNS_PORT.md`):
  - `action_receipts.cjs`: append-only, redacted action receipts with evidence, duration, undo tokens, event-bus events, and HTTP routes at `/api/action-receipts`.
  - `step_watcher.cjs`: OS-agnostic settle-aware step detection with screen fingerprints and `/api/step-watcher`.
  - `response_tags.cjs`: typed `[POINT]/[STEPS]/[PLAN]/[GOAL]/[DO]/[DONE]` parser for **model replies only**; malformed tags dropped, screen content cannot produce tags; `/api/response-tags`.
  - Three new test suites (25 + 14 + 21 checks). Total documented battery: 378 checks across 13 suites.
- Published GitHub Release `v9.6.2` with 4 assets (Setup, Portable, latest.yml, blockmap; release id 449099762).

## [9.6.1] - 2026-11-17

### Fixed
- MCP stdio timeouts raised: `PROBE_TIMEOUT_MS` 15s -> 60s (30s per initialize/tools request), `CALL_TIMEOUT_MS` 20s -> 90s. Heavy real servers such as REA initialize in more than 7.5s on a cold packaged install and previously failed with `initialize timed out after 7500ms`. Verified in the packaged v9.6.1 bundle: real REA probe listed 207 tools in 13.2s and a real `tools/call` succeeded.
- Published GitHub Release `v9.6.1` with 4 assets (Setup, Portable, latest.yml, blockmap; release id 448787142).

## [9.6.0] - 2026-11-17

### Added
- **REA preset (8th official server):** `rea` = `npx -y rea-agents mcp` - REA "Reverse Engineer Anything" (morluto/rea, MIT): evidence-backed analysis of JavaScript/Electron apps, native binaries, .NET assemblies and websites. Live-verified through MYRAA's own stdio transport: probe (207 tools, serverInfo `rea 6.7.0`), real `tools/call` `inspect_electron_fuses` on the installed `MYRAA.exe` (PE x86_64, SHA256-bound). Needs Node 22+.
- MCP tool cache cap raised `MAX_TOOLS` 200 -> 300; REA advertises 207 tools and none are truncated now.

### Changed
- `tests/test_mcp_transport.cjs`: now 32 default checks (8-preset expectations + `rea` add/verify); live mode (`MYRAA_MCP_LIVE=1`) additionally probes `rea` and requires `analyze_javascript_application` to be exposed.
- Docs updated to 318 checks across the 10 documented suites.

### Fixed
- **UI contrast pass** (replica-design method, WCAG AA): `--text-muted` `#657086` -> `#7E8DA4` (3.95:1 -> 5.84:1 on bg, 5.27:1 on surface), new `--border-input` role `#526689` (3.39:1), visible focus state on the input bar (`.bottom-input-container:focus-within`), `mobile_companion.html` 11px label `#64748b` -> `#94a3b8`. All 19 token pairs pass; artifacts in `replica/` (`recon.md`, `design/tokens.json`, `design/components.md`).

### UI and tooling (2026-11-17)
- Installed `@animate-ui/icons-lucide-bell` via `npx shadcn@latest add` into the AURELIA dashboard project; wired as an animated header notification bell with a live alert badge and accessible label.
- Deduplicated animation libraries (`framer-motion` removed, `motion/react` used everywhere): dashboard bundle 557 KB -> 436 KB (gzip 178 KB -> 139 KB), faster load.
- Fixed stale `tests/test_investigation.cjs` assertion: the skill catalog now has 8 entries (4 REA skills), not 4.
- Added `docs/myraa-audit/MYRAA_GAP_AND_UPGRADE_PLAN.md`: verified gaps and a concrete upgrade plan (personal, reliable, earning, automation, fast learning, correctness, GitHub skill ingestion).
- Modernized `tests/verify_final_system.cjs`: runtime version/paths, isolated test port 3011, capability-preservation checks, real installer hash verification - **25 PASS / 0 FAIL** (was 7 PASS / 8 FAIL with stale 9.3.0 assumptions).

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