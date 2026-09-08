# Changelog

All notable changes to MYRAA AI OS are documented here.

## [8.0.0] - 2026-09-08

### Added

#### Phase 1 — Security Hardening
- Security headers (CSP, HSTS, X-Frame-Options, etc.) via `server_security.cjs`
- Rate limiter: 600 req/min general, 60 req/min sensitive endpoints
- LAN guard: non-loopback requests require paired-device token
- WebSocket upgrade guard for voice connections
- `/live` endpoint protected behind LAN guard

#### Phase 2 — MYRAA Core (Unified Chat Brain)
- `myraa_core.cjs`: intent classifier (7 task types), model cascade (Gemini→Groq→OpenRouter→Ollama)
- Unified `/api/chat` with Core-first + legacy fallback
- Cost/attempt/health tracking (`core_stats.json`)
- `MYRAA_CORE_DISABLE=1` escape for zero-regression

#### Model Retirement Fix
- `gemini-2.0-flash` retired → all defaults changed to `gemini-3.5-flash`
- Env-overridable: `MYRAA_FAST_MODEL || GEMINI_CHAT_MODEL || 'gemini-3.5-flash'`

#### Phase 3 — Memory & Knowledge (RAG)
- `memory_kb.cjs`: canonical taxonomy (7 categories), auto-chunking (~512 words)
- 256-dim local embeddings (deterministic, dependency-free)
- Optional Gemini `text-embedding-004` upgrade (`MYRAA_EMBED_REMOTE=1`)
- Cosine retrieval with sources + citations
- `[MYRAA MEMORY CONTEXT]` injected into every Core chat call
- `/api/memory/*` HTTP routes (stats, taxonomy, remember, retrieve, knowledge, rebuild)
- MCP tools: `memory_recall`, `memory_remember`, `memory_ingest`
- Memory panel in `status-dashboard.html`
- Bridge env isolation fix: `sqlite_memory_bridge.py` now honors `MYRAA_DATA_DIR`

#### Phase 4 — Agent/Skills Consolidation
- Unified `/api/skills/catalog` merges 483 dynamic + 515 discovery skills
- `/api/skills/discovery` — full registry with category filter
- `/api/skills/discovery/search?q=` — goal-based skill matching
- `/api/skills/discovery/compose` — multi-skill composition plans
- `/api/skills/discovery/:id` — single skill detail + instructions
- MCP resources updated: memory, skills, permissions URIs

#### Phase 5 — Unified Permissions
- `TOOL_RISK_MAP` covering all known tools
- `/api/permissions/check` + `/api/permissions/risk-map`
- `/api/capabilities/permission-check` bridges Rust + MCP risk models
- Tool executor permission gate before every execution

#### Phase 6 — Dead Layer Audit
- `ai_gateway_service.cjs` confirmed not dead (stats-only usage)

#### Phase 7 — Ecosystem Stability
- `weather_service.cjs`: `http://ip-api.com` → `https://ip-api.com`

#### Phase 8 — Installer & Release Sanity
- `electron-builder.v2.yml` verified (NSIS, DMG, AppImage/deb/rpm)
- Build resources present (icons, NSIS script, entitlements)
- Version sync `7.5.0` across all sources

#### P0 — Vault Migration
- All 12 `.env` secrets stored in SecureVault (AES-256-GCM + Windows Credential Manager)
- Vault fallback wired into chat key resolvers (env → secrets.json → vault)
- Live proof: vault-only key resolution verified

#### P1 — Mobile DeviceToken Enforcement
- Paired-device token required for `/api/remote/`, `/api/mobile/`, `/api/mcp/v1/tools/call`
- Hardened pairing: fresh one-time code, 5-min expiry, loopback-only masterSecret
- `mobile_companion.html`: pairing UI, `remoteCall()` with token injection

#### P2 — .env Scrub
- All 12 secrets scrubbed from all 3 `.env` files (36 values)
- `scripts/scrub_env_secrets.cjs` with scrub/restore/report
- Round-trip verified: 24 keys value-identical

#### Free Public API Registry
- 98 free (no-auth, HTTPS) APIs from public-apis/public-apis
- 24 categories: Animals, Anime, Books, Crypto, Currency, Dev, Entertainment, Environment, Food, Geocoding, Health, ML, Music, News, Photography, Science, Sports, Text, Transport, URL, Weather, Quotes, Games, Utility
- `/api/free-apis/*` HTTP endpoints (stats, categories, list, search, execute)
- MCP tools: `free_api_list`, `free_api_call`

### Security
- `.env` secrets never stored in plain text
- SecureVault DPAPI-backed encryption
- LAN guard prevents unauthorized remote access
- Permission check on all tool executions
- Bridge env isolation prevents test data leaking to production DB

### Fixed
- `gemini-2.0-flash` retirement causing 404 on all chat calls
- `sqlite_memory_bridge.py` ignoring `MYRAA_DATA_DIR` (was hardcoded to `%APPDATA%`)
- `weather_service.cjs` using insecure HTTP for geolocation
- Intent misclassification: "why does my compile fail" now correctly → reasoning

## [7.5.0] - 2026-09-01

### Added
- Initial MYRAA v7.5.0 APEX release
- 515 Cognitive Skills Fleet
- 12 Branded Production Connectors
- Native Win32 Desktop Automation
- Continuous Persistent Conversation Sessions
- FastAPI Agent & Native Win32 Dual-Bridge
