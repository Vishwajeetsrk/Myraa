# MYRAA Existing Capabilities (Phase 0 inventory — reuse, do not duplicate)

## Chat / voice (REUSE)

- `POST /api/chat` (`server.cjs:8398`), WS `/live` chat+audio, Gemini Live voice, Web Speech wake word, STT via SpeechRecognition (`myraa_v6_app.js:2261+`), TTS via speechSynthesis pitch 1.25 (`:2249`) + System.Speech `/api/speak` (`server.cjs:8383`).
- Memory-aware replies via `memory_kb.cjs` retrieve + `myraa_core.cjs` cascade.

## Screen awareness (REUSE — extend consent gating)

- 4 capture backends: Electron desktopCapturer (`electron/main.cjs:870-925`), PowerShell CopyFromScreen (`desktopAutomation.cjs:695`), ScreenVisionPipeline (`server.cjs:3212-3340`, dedupe + cache + `screenVisionState` WS events), scroll stitcher (`screen_scroll_stitcher.cjs`).
- Foreground window: Win32 GetForegroundWindow/Title/PID + idle time (`server.cjs:4800-4850`); 2500 ms desktopPerception poll gated by `desktopAwarenessEnabled` (`server.cjs:8514`).
- UIA tree: `ui_automation_service.cjs` + `ui_automation_runner.ps1`.
- Rate controls: frontend 2500 ms + change-score gate + JPEG q0.45; backend `captureInFlight` dedupe, maxDim clamp, 10 s frame throttle.
- OCR: PARTIAL — only inside frozen `resources/agent/myraa-agent.exe` (pytesseract/winrt, unverifiable) + vision-model OCR (`POST /api/vision/analyze-frame`). No native Node OCR.
- 14+ capture endpoints (`/api/desktop/capture`, `/api/screen-vision`, `/api/system/control`, `/api/vision/*`, mobile screenshot, ...).

## Desktop control (REUSE)

- `desktopAutomation.cjs` (type/click/drag/scroll/clipboard/windows/media), UIA invoke (`ui_automation_service.cjs`), dispatch `server.cjs:4861-5036`.
- Approval: `SafetyPolicy.assess()` + `ConfirmationStore` 120 s TTL (`server.cjs:2693-2769`), `confirmation_required` flow, approved-roots file guard (`:3057-3126`), two-step power tokens, delete requires `confirm=true`. NOTE: native confirmation bridge fails open when port 3010 absent (`:3127-3163`).

## Memory / knowledge (REUSE)

- `memory_core_service.cjs` (JSON + SQLite dual-write, save/get/search/stats), `memory_kb.cjs` (taxonomy preference/identity/episodic/semantic/knowledge/system_fact/location; 512-word chunker; 256-dim deterministic embeddings + optional Gemini; `kb_index.json` overlay; HTTP `/api/memory/*`).
- Dead code to avoid: `memoryCore.saveObservation()` does not exist (called at `apex_v5_routes.cjs:3055, 3079`, swallowed by try/catch).

## AI providers (REUSE)

- AIGateway streaming + failover (gemini/anthropic/openai/grok/deepseek/ollama), ModelRouter task routing (`vision/image`, `document`, `coding`, `reasoning`, `fast`, `local`), cost tables + `estimateCost`, gateway stats persisted.
- Keys resolve `secrets.json -> env -> vault`. Fish Audio is NOT part of the voice chain — leave it alone.

## Ingestion (REUSE; PDF extraction MISSING)

- Uploads (`/api/chat/attach`, multimodal-analyze), `office_doc_engine.cjs` (docx/xlsx/pptx via python; PDF = raw-bytes regex only, not a parser), `web_fetch_service.cjs` (pages, GitHub repos, Figma URLs), RAG chunk+index via `memory_kb.ingest`.
- FS read/search/edit routes with approved-roots guard.

## Jobs / progress (EXTEND — no durable queue)

- Research job step model (RUNNING/COMPLETE/FAILED; step PENDING/ACTIVE/DONE/FAILED; in-memory Map cap 20 + snapshot file).
- GoalManager durable tasks (pending/running/blocked/completed/failed/cancelled; atomic write; restart recovery; DAG dependsOn).
- SSE only in autoUpdateEngine; frontend polls; toasts in `myraa_v6_app.js:144`.

## Integrations (REUSE registry pattern)

- `/api/integrations` live-probed version wins (`myraa_v6_real_routes.cjs:2302-2405`; statuses CONNECTED/NOT_CONFIGURED/INVALID_KEY/OFFLINE/NOT_INSTALLED/SECURE/EMPTY). Apex copy is a shadowed mock.
- Canonical new integration = `packages/api-registry` connector pair (TS types + `dist/myraa_<name>_connector.cjs` + tool registry entry with risk/auditEvent) enforced by `myraa:architecture-check`.
- MCP: MYRAA exposes MCP v1 over HTTP (`skills_mcp_engine.cjs`); TOOL_RISK_MAP + `isToolAllowed()` gate; no external MCP servers configured in-repo.

## Media / misc (REUSE thin)

- `remotion_rendering_service.cjs` (lesson-video rendering scaffold, no progress reporting).
- Notifications: toasts only. Mobile companion endpoints exist.
- Privacy: installer consent toggles (`installer.html:1749`), runtime grant API (`myraa_capabilities_upgrade.cjs:175`), transient SCREEN VISION ACTIVE/PAUSED indicator, no-bytes logging rule in screenVision, 500-entry activity ledger cap.
