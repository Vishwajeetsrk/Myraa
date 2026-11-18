# Changelog

All notable changes to MYRAA AI OS are documented here.

## [Unreleased]

## [9.7.0] - 2026-11-18

First packaged release of the capability-repair program. Includes all work below: truthful capability/health/provider registries, provider-routed chat, screen intelligence with observation→verify, real brand icons, Activity Center / Design Doctor / Settings Workspace, Browser Agent and Capability Gap Analyzer. Installers are unsigned (SmartScreen warning until an EV certificate is supplied).

### Added
- Phase 1 verified implementation map (`docs/myraa-audit/CAPABILITY_MAP.md`) and Phase 2 registry design (`CAPABILITY_REGISTRY_PLAN.md`): every subsystem traced to real entry points, storage, API and health state; fake vs real status catalogued.
- Extended `agi/capability_registry.cjs` with the universal status enum, truthful public views (null latency when never measured), live counters and `/public` + `/summary` routes; new `agi/capability_bootstrap.cjs` registers 12 real subsystems with real health checks.
- New `tests/test_capability_registry.cjs` (16 checks).
- Phase 3 `health_manager.cjs`: one aggregate of measured checks (capabilities, AI lanes, MCP, memory DB, OCR, Windows agent, browser runtime, DNS). Every result carries a real status, measured latency and ISO timestamp; mounted at `/api/health-manager`.
- Phase 4 `ai_provider_manager.cjs`: one adapter abstraction over Gemini, Anthropic, OpenRouter, Ollama, OpenAI, Groq. Reuses the existing gateway lanes; honest capability flags and `NOT_IMPLEMENTED` for unwritten adapters; keys never exposed; mounted at `/api/providers`.
- New suites `test_health_manager.cjs` (12) + `test_ai_provider_manager.cjs` (15).
- Phase 5 `connector_registry.cjs`: connector statuses from the real catalog + env keys + real probes; no vendor logos or CONNECTED claims without a check. Mounted at `/api/connectors-v2`.
- Phase 6 `action_registry.cjs`: 47 actions derived from skills, connectors, model lanes and cached MCP tools, with schemas, risk, permissions and approval requirements. Mounted at `/api/actions`.
- Phase 7 `approval_manager.cjs`: HTTP approval surface over the existing safety broker, workspace cards and tool engine (`/api/approvals`) - request/pending/decide/execute; denials cannot execute.
- New suites `test_connector_registry.cjs` (9), `test_action_registry.cjs` (11), `test_approval_manager.cjs` (10).
- Phase 8 `mcp_manager_v2.cjs`: management facade over the existing MCP manager (discover/connect/disconnect/enable/inspect/logs/presets/install); tools/resources/prompts honesty preserved. Mounted at `/api/mcp-v2`.
- Phase 9 `skill_registry.cjs`: 532 catalogued skills with installed/health derived from real SKILL.md files (live: 530 READY / 2 UNAVAILABLE, no hardcoded ACTIVE). Mounted at `/api/skills-v2`.
- New suites `test_mcp_manager_v2.cjs` (13), `test_skill_registry.cjs` (14).
- Phase 10 `agent_delegation.cjs`: specialist delegation over the existing 28-agent orchestrator with structured results, real task.* events and honest failures. Mounted at `/api/agents-v2`.
- Phase 11 `task_engine.cjs`: persistent task state machine (QUEUED/RUNNING/WAITING_FOR_APPROVAL/PAUSED/COMPLETED/FAILED/CANCELLED), approval attachment, real events and route CRUD. Mounted at `/api/tasks`.
- New suites `test_agent_delegation.cjs` (13), `test_task_engine.cjs` (17).
- Phase 12 `project_index.cjs`: real project discovery with bounded file counts/git facts and a memory overview across actual stores; unknown values are `null`, never zero or placeholders. Mounted at `/api/projects-v2`.
- New suite `test_project_index.cjs` (13).
- Phase 13 `avatar_state_bridge.cjs`: real voice/task/approval signals (conversation events, task events, approvals) drive an avatar state label at `/api/avatar/state`; a read-only frontend addon publishes `data-myraa-state` + `myraa:avatar-state`. The 3D model, meshes, shaders, eye tracking and camera are untouched. Voice-state events now emitted at the actual WebSocket conversation transitions.
- New suite `test_avatar_state_bridge.cjs` (16).
- Phase 14 UI polish (additive overlays only): `ui_polish_phase14.css` (visible focus rings, scrollable panels/modals, 32px header hit areas, reduced-motion, header-safe floating bar), `ui_accessibility_addon.js` (raises sub-11px inline text, adds aria-label/title to icon-only controls, watches dynamic DOM), and moved the floating control bar below the header. The compiled React bundle and 3D avatar are untouched.
- New suite `test_ui_polish.cjs` (17).
- Phase 15 `diagnostics_center.cjs`: one diagnostics catalog aggregating the real HealthManager, capability registry, skill/project/memory state and asset checks; microphone/GPU are honestly UNAVAILABLE when no real probe exists. Exports a markdown report. Mounted at `/api/diagnostics-center`.
- New suite `test_diagnostics_center.cjs` (14).
- Phase 16 `test_api_surface.cjs` (8 checks): every new module exports a working router and is mounted in the server; no fake status/version/emoji literals in new code.
- Phase 17: `content-visibility` + intrinsic-size hints for long lists, screen-reader live region announcing real avatar states, icon labels/tooltips, reduced-motion and focus rings preserved. New suite `test_accessibility_perf.cjs` (12 checks).
- Total 588 checks across 29 suites. All 17 phases of the product-repair plan have a real implementation slice; avatar/voice/working capabilities preserved.

### P0 — security + correctness (v9.7+ upgrade)
- `/api/chat` now routes through the single provider abstraction (`ai_provider_manager`) instead of calling the Gemini SDK directly; reports provider/model/source and has an honest offline fallback. Live-verified: reply returned via `provider_router` with Gemini.
- Implemented a real Gemini chat adapter in the provider manager (host-allowlisted, bounded, parsed, no key leakage).
- Privileged routes (`/api/mcp/call`, `/api/plugins/execute`, `/api/browser/*`, `/api/approvals/execute`, `/api/terminal/run`) now require a paired-device token from the LAN.
- Electron permissions replaced unconditional `callback(true)` with an explicit allowlist; unknown permissions are denied and logged.
- Removed the duplicate Apex route mount and hardcoded version fallbacks (`9.5.0`/`8.3.2`/`9.3.0`) — versions are read from `version.json`, with honest `0.0.0` when unavailable.
- New `tests/test_p0_security.cjs` (16 checks); provider suite extended to 17. Total 606 checks across 30 suites.
- P1 UX foundation: MYRAA Design System (`myraa_design_system.css`) with one token layer and shared panel/card/status styling; wider settings/memory workspaces; `myraa_shell_addon.js` adds a real-data status strip, a Capability Center (natural-language search across real skills/actions/connectors), and Ctrl+K command palette; static VERIFIED/ACTIVE badges are corrected to UNVERIFIED/MANIFEST VERIFIED. All numbers come from live APIs; avatar and 3D untouched. New suite `test_p1_shell.cjs` (16 checks). Total 622 checks across 31 suites.
- Screen Intelligence first slice (screen-agent spec phases 2-4, 6): `screen_intelligence.cjs` builds one normalized ScreenContext from existing UIA/OCR/capture services, gates observation on real consent, reports sources honestly (`UNAVAILABLE` when no image bytes), and resolves targets semantically (UIA exact/partial/type) before an explicit low-confidence coordinate fallback. Mounted at `/api/screen-intelligence`. Implementation map: `docs/myraa-audit/SCREEN_INTELLIGENCE_MAP.md`. New suite `test_screen_intelligence.cjs` (14 checks).
- Action → Observe → Verify (spec phases 7-8): `action_verifier.cjs` captures a real before/after ScreenContext around approved UIA actions, writes receipts, emits `action.verified`, and reports `verified:true` only when a real observation changed; missing approval gives `APPROVAL_REQUIRED`, unimplemented executors give `NOT_IMPLEMENTED`. Mounted at `/api/action-verification`.
- New suite `test_action_verifier.cjs` (12 checks).
- Design ecosystem (user-supplied repos): Owl-Listener/designer-skills (MIT, 111), ui-ux-pro-max-skill (MIT), bergside/awesome-design-skills (67) installed additively into `%USERPROFILE%\.agents\skills`; MYRAA skill discovery now scans that directory (live: 717 catalogued / 715 verified SKILL.md). Installed `@thesvg/react@4.0.12` (MIT) and added `brand_icon_registry.cjs` serving 7,681 real brand SVGs at `/api/icons/icon/:name` with currentColor mono variant; unknown names return NOT_FOUND (no fake logos). Audit: `docs/myraa-audit/UI_CAPABILITY_AUDIT.md`.
- New suite `test_brand_icons.cjs` (21 checks). Design-critique pass on the design-system overlay: larger nav hit areas, raised/roomier composer, readable pills/badges (3 new P1 shell checks). Total 672 checks across 34 suites.
- Activity Center + Screen Awareness HUD: `activity_center.cjs` aggregates real events, tasks, receipts, approvals, connector/capability/health state at `/api/activity-center/summary`; a compact collapsible HUD (`myraa_screen_hud_addon.js`) renders consent, task/approval/skill counts and recent real events with `UNAVAILABLE` for missing data. New suite `test_activity_center.cjs` (15 checks).
- Design Doctor (`design_doctor.cjs`, `/api/design-doctor`): evidence-based static critique of real UI files (tiny text, focus rings, emoji, hardcoded tokens, computed WCAG ratios), with file:line evidence and explicit honesty that no screenshot was seen. Reachable from the Ctrl+K palette. New suite `test_design_doctor.cjs` (15 checks).
- Settings Workspace (`myraa_settings_workspace_addon.js`): wide, searchable dialog with 9 sections reading only real backend APIs; single actionable control is screen-awareness consent (real POST), everything else honestly READ ONLY. Reachable from Ctrl+K. New suite `test_settings_workspace.cjs` (13 checks). Total 715 checks across 37 suites.
- Browser Agent (`browser_agent.cjs`): real automation via `playwright-core` driving the installed system Chrome (resolved executable path, `MYRAA_BROWSER_PATH` override) with start/navigate/screenshot/state/stop and action history. `/api/browser/*` capabilities report the real runtime source and browser path, never a fake "connected" label. New suite `test_browser_agent.cjs` (11 checks), live-verified real Chrome launch + navigation (title "MYRAA Live Browser").
- Capability Gap Analyzer (`capability_gap_analyzer.cjs`): maps a natural-language request to real capabilities, checks each against runtime evidence, and returns a concrete implementation plan for gaps. Uses only truthful statuses (`NOT_IMPLEMENTED`, `DEPENDENCY_MISSING`, `CONFIGURATION_REQUIRED`, `PARTIAL`, etc.); no fake `CONNECTED`/`ACTIVE`. Mounted at `/api/capability-gap` (`/catalog` + `/analyze`), live-verified. New suite `test_capability_gap.cjs` (12 checks).
- Docs: `docs/MYRAA_CAPABILITY_MATRIX.md` (runtime-verified status per capability) and `docs/MYRAA_LIMITATIONS.md` (what MYRAA cannot do, why, and the dependency required).
- Video Intelligence Engine core (`video_engine.cjs`): real ffprobe/ffmpeg wrapper with `status`, `probe`, `validate`, `analyze` (real scene + silence detection -> neutral timeline), `thumbnail`, and `edit` (trim, split, concat, crop, resize, rotate, speed, mute). Every operation validates the output with ffprobe before claiming success; vision/ASR features are explicitly `NOT_IMPLEMENTED`. New suite `test_video_engine.cjs` (17 checks, all against a real generated clip). Docs: `docs/MYRAA_VIDEO_ENGINE.md`.
- Skill Runner (`skill_runner.cjs`, `/api/skills-runner`): bounded execution for the 44 skills with real scripts — allowlisted interpreters, no shell, sanitised env, timeout, path-traversal rejection, redacted receipts, and a real HIGH-risk approval gate via `approval_manager`. Manifest `"status":"ACTIVE"` is never trusted; status is recomputed. Instruction-only skills return `NOT_EXECUTABLE`/`NOT_IMPLEMENTED`. New suite `test_skill_runner.cjs` (17 checks). Docs: `docs/MYRAA_SKILL_SYSTEM.md`.
- Application Adapter Registry (`application_adapters.cjs`, `/api/application-adapters`): 16 adapters detected from live window metadata (no fake ACTIVE), real UIA `inspect`/`read`/`locate`/`verify`; Chromium-class disambiguation bug found and fixed (title required for Chrome/Edge/VS Code/Figma/Canva). `edit`/`execute` remain honestly `NOT_IMPLEMENTED`. New suite `test_application_adapters.cjs` (18 checks). Docs: `docs/MYRAA_APPLICATION_ADAPTERS.md`.
- Parallel Runner (`parallel_runner.cjs`, `/api/parallel`): bounded pool over real module functions with a genuine job graph — dependencies, priority, retry, real timeout, cancellation, progress and aggregated results; append-only receipts. Fixed a real bug where a missing dependency left a job permanently queued (now rejected at submit). New suite `test_parallel_runner.cjs` (17 checks). Docs: `docs/MYRAA_PARALLEL_RUNNER.md`.
- Capability Gap Engine → central capability intelligence (Phase A): extended the existing `capability_gap_analyzer.cjs` with the full gap schema (`dependencies`, `availableAlternatives`, `implementationPlan`, `estimatedComplexity`, `requiresUserAction`, `safeToAutoImplement`), a `canDo()` verdict engine (`YES`/`YES_WITH_APPROVAL`/`YES_WITH_SETUP`/`PARTIAL`/`NO_YET`/`UNSAFE`/`UNKNOWN`), dependency resolver, implementation planner with curated reusable systems, durable task creation for safe capabilities only, and `selfTest()`. Added honest `connector.oauth` and `mcp.http` gap checks. New routes: `/can-do`, `/gaps`, `/gap/:id`, `/plan/:id`, `/task/:id`, `/self-test`. No repository/package is installed or executed automatically.
- Fixed three real bugs found by tests: unrelated SVG repo listed under video gaps, `NO_YET` masked by approval metadata, and task creation used wrong field (`goal`, not `title`).
- Audit finding (deferred, not faked): `ai_gateway_service.cjs`, `memory_kb.cjs`, `myraa_core.cjs` and `myraa_v6_real_routes.cjs` still reference provider SDKs directly; `/api/chat` is already unified through `ai_provider_manager`.
- Total 820 documented checks across 43 suites (gap suite 12 → 25); 58 `test_*.cjs` files present in `tests\`.

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