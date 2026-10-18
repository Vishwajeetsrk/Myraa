# MYRAA Architecture Audit (Phase 0 — audit only, no production files modified)

Repo: `C:\Users\Vishwajeet\Music\Myraa` · branch `main` · version 9.3.1 · Electron + Tauri sidecar

## Runtime shape

- **Shell:** Electron (`resources/app/electron/main.cjs`, `SERVER_PORT=3000`, spawns backend) + Tauri sidecar (`src-tauri/`).
- **Backend:** single Node/Express server `resources/app/dist/server.cjs:5061 startServer()`. Port 3000 (`MYRAA_PORT`/`PORT` override; forced 3000 under Electron). Binds `0.0.0.0` (LAN/mobile enabled).
- **Frontend:** bundled SPA `resources/app/dist/assets/index-*.js` (React) + legacy views `myraa_v6_app.js`, `ui-health-patch.js`, `myraa_hud.js`.
- **Router mount order** in `startServer()` (order decides shadowing, all flat `/api/...`):
  1. `server_security.cjs` middleware (headers, rate limit, LAN guard) — `server.cjs:5066`
  2. `myraa_v6_real_routes.cjs` — `:5073` (~130 routes, mounted first, wins conflicts)
  3. `apex_v5_routes.cjs` — `:5080` (~160 routes; mounted AGAIN at `:8472` — duplicate)
  4. inline server routes `:5322-6385`
  5. `skills_mcp_engine.cjs` — `:8474` (MCP v1 over HTTP, skills, mobile)
  - nested routers: `memory_kb.cjs` (under v6), `autoUpdateEngine` (under apex), plugin routes (`myraa_v6_real_routes.cjs:162-184`)
- **WebSocket `/live`** (`server.cjs:6388+`, pair-token upgrade gate): chat/audio/transcription/memory/toolCall/cognitionDecision/screenVisionState. Per-connection sends only; **no global broadcast exists**.
- **Data:** JSON-on-disk under `%APPDATA%\MYRAA\` + SQLite via `sqlite_memory_bridge.py` subprocess (`myraa_memory.db`). Supabase/Postgres = empty env placeholders only; zero code usage, no migrations directory.

## Protected systems (never modify without explicit approval)

Avatar (3D model/textures/rig/animations/state), voice identity (see VOICE below), chat/voice flow, desktop-control, memory, skills/MCP, integrations, settings, security layer.

## Voice (existing, unchanged — Fish Audio NOT in the chain)

- Text-chat replies: browser `speechSynthesis`, default OS voice, `rate=1.02, pitch=1.25` — `myraa_v6_app.js:2249-2258`.
- `POST /api/speak` (`server.cjs:8383-8396`): Windows System.Speech, Female hint.
- Live voice: Gemini Live over WS `/live` (About page ENGINE field). Wake word via Web Speech API.
- Course Studio narration MUST reuse these three paths. No new TTS provider.

## Verified extension seams

- **New router:** `course_studio_routes.cjs` (`express.Router()`), mount in `startServer()` after `:5074`.
- **Plugins:** `plugin_manager.cjs` loads `resources/app/plugins/<name>/plugin.json` + `index.cjs`; `tools[]` callable via `skills_mcp_engine.cjs:721` and `POST /api/plugins/execute/:tool`. Reference: `plugins/myraa-utils/`. NOTE: `onChat` hook is dormant (never invoked) — do not build on it.
- **Progress push:** only SSE template is `autoUpdateEngine.cjs:75-99, 321-335`; frontend otherwise polls job status (`myraa_v6_app.js:2339`).
- **AI:** `ai_gateway_service.cjs` (streaming, circuit breaker, cost table; gemini/anthropic/openai/grok/deepseek/ollama) + `model_router.cjs` (task-type routing + fallback). Chat cascade in `myraa_core.cjs`.
- **Events:** `CognitiveEventBus` (`server.cjs:764-807`, 200-event ring buffer).
- **Jobs:** no durable queue. Templates: research-job step model (`myraa_v6_real_routes.cjs:2109-2138`, in-memory Map + last-job snapshot) and GoalManager durable task graph (`server.cjs:816-991`, atomic JSON, restart recovery, dependency DAG).

## Existing learning-adjacent code

`passive_learning_service.cjs` = UI workflow recorder (not curriculum). `/api/teach`, `/api/learn/web|github`, `mistake_learning_engine.cjs`, RAG ingest in `memory_kb.cjs`. Zero course/lesson/quiz/learner-model code — roadmap "Study mode" is PLANNED (`MYRAA_ROADMAP.md:377`).

## Tests / gates

No test framework. Convention: plain `tests/test_<feature>.cjs` (ok/bad counters + exit code). Real CI gate: `npm run myraa:architecture-check`. `tests/verify_final_system.cjs` is STALE (asserts 9.3.0 vs 9.3.1). Response shape `{ok:true,...}` / `{ok:false,error,code}`. Zero emojis anywhere. Dynamic version only. No hardcoded paths.
