# MYRAA implementation map — Phase 1 (verified code audit)

Date: 2026-11-18 · Version: 9.6.3 · Method: read-only source inspection by three parallel mappers.
This is the implementation map required before any repair. Status legend:
**REAL** = wired and functional · **PARTIAL** = works but incomplete · **DECORATIVE** = registered/advertised but never executed or faked · **BROKEN** = fails in normal use · **DUPLICATE** = competing implementations.

## Desktop Host — REAL with gaps
- Entry `resources/app/electron/main.cjs`; IPC `myraa:get-about|get-diagnostics|open-folder|get/set-startup|self-repair|recovery-*|window:*|screen:get-sources` (`:55-95,1068-1236`).
- Spawns backend `dist/server.cjs` with `ELECTRON_RUN_AS_NODE=1`, `MYRAA_LAUNCHED_BY=electron`, `MYRAA_DATA_DIR`, `PORT=3000` (`:711-732,787-794`); 90s ready timeout (`:322`). Packaged startup fix for nested asar NODE_PATH already shipped in v9.6.3.
- Gaps: permission handler grants everything unconditionally (`callback(true)`, `:1265-1277`); `use-fake-ui-for-media-stream` (`:262`); inconsistent version fallbacks (`8.3.2`, `9.3.0`, `:39,41,544`).

## Backend — REAL, messy
- `dist/server.cjs` (8906 lines, esbuild bundle), `startServer()` `:5128`. Mount order: security → course/awareness/compute/pointer/gesture/evidence/rea → connector-market → model-gateway → events/timeline → Phase 29 routes → permissions/MCP → **realRoutes** (`myraa_v6_real_routes.cjs`, `:5268`) → **apexRoutes** (`apex_v5_routes.cjs`, `:5276`) → inline routes → static/health/chat → **apexRoutes mounted again** (`:8679`) → skills_mcp.router (`:8682`).
- `apex_v5_routes` double-mounted (`:5276,8679`). `/api/chat` (`:8605`) bypasses all AI layers — direct `GoogleGenAI` with `gemini-2.5-flash` (`:8639,8650`).
- Storage: `MYRAA_DATA_DIR || cwd`; `memories.json`, `settings.json`, `secrets.json`, `cognition/{memories,goals,skills}.v1.json`, `api-hub/*`, `events.jsonl`, `action_receipts.jsonl`, SQLite `memory/myraa_memory.db`. Many hardcoded `%USERPROFILE%\Music\Myraa` fallbacks (`:148-149,4679`).
- No tests for server.cjs itself.

## AI Router / providers — 4 competing stacks, mostly unwired
| Stack | State | Notes |
|---|---|---|
| `ai_gateway_service.cjs` | REAL but only used by `myraa_core`, `compute_executors`, `course_studio_routes` | Streaming, circuit breaker, cost table; default `gemini-3.5-flash` (likely nonexistent, `:198`); no tests |
| `model_router.cjs` | REAL, used by agents/orchestrators, not by server directly | Bedrock-first routing (`:139-222`), same suspect model IDs; no tests |
| `myraa_core.cjs` | REAL via `myraa_v6_real_routes.cjs:360` | OpenRouter/Groq/Ollama cascade; `CHAT_MODEL=gemini-3.5-flash`; cost table keyed `gemini-2.0-flash` ⇒ Gemini cost always 0; `health()` hardcoded `core:'active'` (`:346`) |
| `model_gateway.cjs` | REAL + mounted at `/api/model-gateway` (`:5209`) | 4 lanes, real probes; only AI module with tests; hardcodes `version:'20.0.0'` (`:280,285,294`) |

Model ID inconsistency across stacks: `gemini-3.5-flash`, `gemini-2.5-flash`, `gemini-3.1-flash-live-preview`, `gemini-2.5-flash-native-audio-latest`. No OpenRouter adapter in the mounted gateway despite OpenAI-compatible API being available.

## Voice — PARTIAL / fake status
- WS `/live` (`:6598-6699`), `ai.live.connect` with `GEMINI_LIVE_MODEL || gemini-2.5-flash-native-audio-latest` (`:6825`), voice Aoede; supervisor `gemini_live_supervisor.cjs`.
- `/api/live/status` (`:6362-6369`) permanently reports `IDLE`: `currentStatus` initialized `:33` and never assigned. **BROKEN/fake.**
- `/api/speak` (`:8590`) fire-and-forget PowerShell speech; reports `spoken:true` without verification.
- Existing avatar/voice identity must be preserved (AGENTS.md rule 5/6).

## Avatar — PRESERVE
- 3D companion model/assets intact in `dist/assets/characters/evelyn/`; camera/eye-tracking and animations untouched by all prior work. No runtime-state bridge to voice/tool events yet (Phase 13 of the repair plan).

## Memory — 5 overlapping stores
- SQLite bridge `sqlite_memory_bridge.py` (tables memories, sessions, app_knowledge, project_index, cs_*, cp_*; DB `%MYRAA_DATA_DIR%/memory/myraa_memory.db`).
- `memory_core_service.cjs` (JSON + SQLite dual write; `spawnSync('python')` hardcoded `:48`; `getStats` hardcodes `wal_enabled:true,durable:true` `:240`).
- `memory_kb.cjs` (7-category taxonomy, 256-dim hashed embeddings, `/api/memory/*`), cognition `memories.v1.json` inlined in server, `heartbeat_memory_engine.cjs` **unwired**, ignores `MYRAA_DATA_DIR`, embeds PII, two passive learners with different roots. No memory tests. This explains "no memories" in the UI despite data elsewhere.

## Skills — DECORATIVE counts
- `skill_discovery_engine.cjs` scans 6 dirs including hardcoded user paths (`:4-7,38-39`); `SKILL_REGISTRY` Map; returns `getRegistrySummary()`.
- `skills_mcp_engine.cjs` has static 6-skill `SKILLS` array with `status:'ACTIVE'` (`:788,841`) and 30 MCP_TOOLS (`:73-534`).
- UI number "532 ACTIVE" is not derived from a registry. No skill tests.

## Tools / MCP — real transport, decorative approval
- MCP manager `mcp_manager.cjs`: 8 presets, real stdio handshake/tools/call, honest `NOT_IMPLEMENTED` for http, state `%APPDATA%\MYRAA\mcp\servers.json`; agi tools `mcp_call` declared HIGH.
- `skills_mcp_engine.executeTool` calls `isToolAllowed(name,{})` with empty context (`:588`) ⇒ risk gate never fires; risk map only enforced on `/api/permissions/check`.
- AGI tool engine (`agi/tool_execution_engine.cjs`) has real risk gate/timeout/rollback but **server only registers tools into it — never executes**; all registered agi tools (connectors, MCP, permissions, events) are decorative.
- `POST /api/mcp/call`, `/api/terminal/run`, `/api/plugins/execute/:tool` have no approval or LAN token gate (only `/api/mcp/v1/tools/call` is token-gated).

## Connectors / plugins — real network, fake status
- `connector_market.cjs`: 8 declarative connectors, real bounded fetch + host allowlist, env-only keys with `AUTH_REQUIRED`; no invoke HTTP route; agi tools unreachable. Parallel `myraa_<name>_connector.cjs` duplicates exist.
- `plugin_manager.cjs`: real dynamic `require()` of manifest `main` with no signature/sandbox; `/api/plugins/execute/:tool` unguarded. `plugin_health_service.cjs` is a hardcoded 10-plugin catalog; `pingHost` treats connection errors as success (`:169-172`).
- `GET /api/integrations` (`apex_v5_routes.cjs:3002-3018`) returns fake `CONNECTED` + hardcoded personal account and `lastSync:'10 mins ago'`.
- `GET /api/capabilities` (`apex_v5_routes.cjs:2478-2526`) returns hardcoded `REAL`/`verified:true`/`last_tested:now` — fake provenance.
- `GET /api/agent-health` fake always-online v6 route (`:1077`) shadows real probe (`server.cjs:5977`).

## Browser / Windows / Screen — mixed
- `browser_agent.cjs`: **BROKEN** — Playwright not installed, `start()` throws (`:28-49`); advertised capabilities lack routes; `evaluate` unguarded.
- `desktopAutomation.cjs`: real Win32 (PowerShell, ~92 methods); `takeScreenshot` returns `ok:true,image:null` headless (`:716`); `sendFileWhatsApp`/`sendFileEmail` only open web compose URLs (decorative).
- `terminal_runner.cjs`: real `cmd.exe /c`, kills shell only not process tree; `startDevServer` resolves on 5s timer (`:240-246`).
- Screen: 4 capture backends, consent gating, real OCR via `tesseract.js` (`ocr_engine.cjs`); stray `dist/screen_awareness_consent.json` has `enabled:true` but no loader reads it; legacy `.myraa-data/permissions.json` grants everything and is not used by the new permission model.

## Learning / Agents / Jobs
- Multi-agent orchestrator: 28 agents registered, private EventEmitter with `:`-names, **sequential** loop despite "parallel DAG" claim, not wired into server.
- Coding orchestrator: ~50 regex intents, wired as native tool handler (`server.cjs:5067`), emits real unified-bus events.
- GoalManager inlined in server with durable `goals.v1.json`; task timeline read-only merge; compute/course job modules have tests. No durable global queue; no global WS broadcast.

## Database / Security / Settings
- SQLite bridge + JSON overlays; no migrations framework; no duplicate DB service creation needed.
- `secure_vault.cjs`: AES-256-GCM with MachineGuid+PBKDF2 (not DPAPI), weak fallback salt, `cmdkey /pass` on command line, hardcoded user paths/emails; `world_awareness_engine.cjs` writes API keys plaintext to `~/.myraa/world_config.json`. Keys must never reach React.
- Settings persisted in `settings.json`; no fake toggles should be introduced; security center to be built on `tool_permissions.cjs` + `safety_broker.cjs`. `safety_broker` has no HTTP surface (voice-only approval path); binding params persisted plaintext.

## Health / status endpoints (truthfulness verdict)
REAL: `/api/model-gateway`, `/api/api-hub/health`, `/api/events`, `/api/timeline`, `/api/memory/stats`, `/api/cognition/status`, Phase 29 routes.
SEMI-FAKE: `/api/health` (static `ok`, version fallback hardcoded).
FAKE: `/api/agent-health`, `/api/live/status`, `/api/system/about.status`, `/api/integrations`, `/api/capabilities`, plugin health internals, `myraa_core.health()`.

## Tests
28 standalone Node suites green; only `model_gateway`, connector market, safety broker, permissions/MCP, event bus, timeline, Phase 29 modules are covered. No tests for server wiring, AI gateway/router/core, voice, memory, skills, orchestrators, browser, plugins, terminal, vault. No `npm test` script.

---
## Frontend / UI — REAL shell, decorative React settings
- Load chain `dist/index.html:14-27`: tauri-bridge → ui-health-patch → universal-control-addon → myraa_v6_app.js → panels → React bundle → CSS.
- `ui-health-patch.js:3019` "532 Active" is **backend-driven** from `/api/skills/catalog`; the word "Active" and stale "69+" placeholders are hardcoded (`:2846,2851`).
- React settings bundle `assets/index-qnLjC2CG.js` is largely static: "ENABLED" plugin cards + Gmail account (`:815`), IoT battery/printer/appliance values (`:770-793`), vault account list + wrong `%APPDATA%\JARVIS` path (`:802-808`), About "v9.0.0 / FastAPI Agent / Web Speech API" (`:858`). Gemini key field is real. Version partially patched at runtime by `ui-health-patch.js:5352`.
- Hardcoded status strings: `BRANDED_PLUGINS` badges ACTIVE/VERIFIED/CONNECTED/OPERATIONAL/STREAMING in `myraa_v6_real_routes.cjs:1311-1411` (overridden on probe failure); `ui-health-patch.js:3889` fallback `'VERIFIED'`; baseline latencies 4-35ms at `:1312...1411`; "Ping: {latencyMs}ms" comes from a real probe template, but baseline values are invented.
- "LEARNING: IDLE" is hardcoded default, state polled from `/api/teach/passive/status` (`universal-control-addon.js:42,60-79`). Voice button `.recording` CSS has no JS toggle in the composer (`ui-health-patch.js:1590`) — decorative.
- Layout risks: `index.html:29-40` locks `overflow:hidden`; min window 940x600 makes 7 right-side controls wrap (`myraa_v6_styles.css:131-260`); fixed centered floating bar z-index 99998 overlaps header z-index 50; right panel 310px with 9-12px text; badges 8.5-10px; labels hidden <1280px without tooltip fallback.
- Compiled React source is not in the repo → cosmetic/fake React cards cannot be rebuilt from source here (P0-4 blocked; REA source recovery requires Linux x64). Runtime patching is possible but fragile due to hashed-class `!important` overrides.

## Phase 2 status (implemented this pass, source-only)
- Extended `agi/capability_registry.cjs` with the universal status enum, `publicView()` (null latency when never measured), live counters, `/public` + `/summary` routes.
- Added `agi/capability_bootstrap.cjs`: registers 12 real subsystems with real file/registry/credential health checks.
- Replaced hardcoded `GET /api/capabilities` (`apex_v5_routes.cjs:2478`) with registry-derived records + real `healthSummary()`; live result: 12 capabilities, 10 READY, 2 ERROR (browser missing Playwright, screen consent disabled) — measured latencies, no invented timestamps.
- Fixed `/api/agent-health` (no more always-online fallback; real probe result and real tool count) and `/api/live/status` (status derived from actual WebSocket client count).
- New `tests/test_capability_registry.cjs`: 16 checks, all green.

## Capability matrix (verified at this point)

| Capability | Implementation | Backend | Frontend | Authentication | Health check | Test result | Current status | Missing requirement |
|---|---|---|---|---|---|---|---|---|
| Backend host | server.cjs | Express :3000 | status bar (partial) | none | /api/health + registry | verifier 25/25 | READY | version field still static in /api/health |
| AI routing | 4 stacks; model_gateway mounted | gateway/router/core | provider cards (static) | env/vault keys | model-gateway probe | test_model_gateway green | PARTIAL | unify stacks; OpenRouter adapter in mounted gateway |
| Voice | Gemini Live WS | /live + supervisor | mic button (limited states) | GEMINI key | real WS client count | none | PARTIAL | supervisor state never assigned; UI states incomplete |
| Avatar | existing 3D model | n/a | intact | none | none | n/a | PRESERVE | runtime state bridge to events |
| Memory | 5 stores, SQLite canonical | /api/memory/* | memory panel | none | db file check | none | PARTIAL | one source of truth; fix "no memories" panel |
| Skills | discovery + static 6-skill list | /api/skills/* | count from backend | none | registry reachable | none | PARTIAL | real registry fields/actions/health |
| MCP | stdio client + 8 presets | /api/mcp/* | no dedicated panel | per-server | probe/call real | 32 checks green | REAL | http transport; approval on /api/mcp/call |
| Connectors | 8 declarative + duplicates | connector-market | cards mixed | env keys | catalog + probes | test green | PARTIAL | OAuth flows; real invoke route; no fake badges |
| Browser agent | Playwright-based | /api/browser/* | none | n/a | module check | none | BROKEN | playwright dependency missing |
| Windows control | desktopAutomation | many routes | addon controls | consent/approval | module check | none | PARTIAL | approval enforcement for sensitive ops |
| Screen/OCR | 4 capture backends + tesseract | consent-gated routes | transient indicator | consent | consent file | none | PARTIAL | stray pre-consent artifact; redaction enforcement |
| Plugins | dynamic require | /api/plugins/* | static cards | none | catalog probes | none | DECORATIVE | signing/sandbox; truthful badges |
| Safety/approval | broker + permissions | voice-only broker | none | approval card | permission engine | tests green | PARTIAL | HTTP approval surface; HIGH tool enforcement |
| Capability status | new registry | /api/capabilities | not wired yet | n/a | real health checks | 16 checks green | REAL (source) | ship in installer; frontend consume registry |

