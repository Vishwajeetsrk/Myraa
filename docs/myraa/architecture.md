# MYRAA AI OS — Architecture (v7.5.0 + Universal Registry Expansion)

> Existing codebase is truth. This file adds the universal layer WITHOUT replacing modules.
> Identity preserved: MYRAA name, Nai.vrm girl model/face, voice identity, UI, modules, functions, animations.

## Verified inventory (2026-09-08)
- Shell: Tauri 2 (`src-tauri/tauri.conf.json`, `lib.rs` 1315 lines, 57 commands) + Electron fallback + `resources/app/dist/` (server.cjs 380k, desktopAutomation.cjs 83k Win32 REAL).
- Core: FS gate + trash, system (netsh/WMI/PS), vault → keyring DPAPI, SQLite memory (`myraa_memory.db`), session resume, capability_list + feature_truth + permission_check, teach drafts/versioning, office docx/xlsx/pptx REAL, ADB partial, Gemini Live backoff (no Rust STT/TTS yet).
- Plugins (8 tiles, infra REAL / API MOCK): Gmail, Salesforce, Excel, YouTube + GitHub, GCloud, Figma, Canva.
- Skills: 403 native (`skills/`) + 405 Downloads + 481 `.agents` — many thin stubs (`web-research/SKILL.md` 29 lines); need versioning + requiredTools wiring.
- Voice: Web Speech + Fish Audio + Gemini Live WS; MUST keep same voice (improve latency/streaming only).
- Avatar: `Nai.vrm` 16.36MB + three-vrm states — DO NOT TOUCH.
- AI: Gemini (primary) + Groq + OpenRouter + Ollama via `model_router.cjs` + `ai_gateway_service.cjs` — route by complexity/latency/cost/privacy.

## Target (§64)
```
MYRAA → INTERFACE → KERNEL → AI GATEWAY + MEMORY + CONTEXT → TASK/AGENT RUNTIME → SKILLS + TOOLS + KNOWLEDGE → CONNECTOR REGISTRY → APIs / Windows / Browser → External
```

## Layering rules (enforced by `npm run myraa:architecture-check`)
- No direct fetch to external API from UI/dist (except existing verified research path, to be migrated to connector).
- All new APIs via `packages/api-registry/` connector + tool.
- All tools have schemas + risk + audit.
- High-risk needs confirm; secrets never in UI/logs.
- AI via gateway with fallback; memory canonical (SQLite); skills versioned.
- Voice/avatar assets untouched.

## Duplication to resolve (adapters, not rewrite)
- `server.cjs` vs `myraa_v6_real_routes.cjs` (+2 backups) vs `apex_v5_routes.cjs` — dedupe routes behind connector adapters.
- `*.bak` / `*.backup_v75` in dist — archive, don't ship.
- Skill stubs (403) — keep ids, upgrade content + `skill.json` requiredTools/connectors gradually.
- Memory LIKE-only — add embeddings later, keep SQLite.

## DB (reuse, no second DB)
Add only as needed: api_providers, api_credentials_metadata (ref only), api_usage, connectors/accounts/resources, tools/tool_runs, skills/skill_versions, plugins/installations, tasks/steps/agent_runs, events, audit_logs.
