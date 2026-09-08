# MYRAA — API Integration Roadmap (incremental, adapters, no rewrite)

## Phase 0 — Foundation (this change, DONE)
- [x] `packages/api-registry/` (registry, connector interface, tool registry, policies, health, schemas)
- [x] `docs/myraa/apis/` (catalog, matrix, roadmap, security review)
- [x] `npm run myraa:architecture-check` (guards identity + layering)
- Rule: additive only. No change to Nai.vrm, voice identity, UI, Tauri commands, dist routes.

## Phase 1 — Make existing REAL (P0, next)
1. GitHub REST via reqwest + `github_token` (vault) + repo allow-list. Keep `feature_truth` PARTIAL until live call verified.
2. Gmail REST (read first, send with modal) + OAuth refresh.
3. Google Calendar read → daily briefing uses `display_name` (fix hardcoded "Vishwajeet").
4. Kill-test real Tauri binary → session resume. `tauri build` → replace Electron stub installer.

## Phase 2 — No-key capabilities (P0/P1, safe)
1. Weather connector (Open-Meteo) → `myraa.weather.get` → voice "what's weather?" + existing Myraa voice output.
2. Currency (Frankfurter) → read-only + disclaimer.
3. Holidays (Nager.Date) → briefing.
4. RSS news → cache + ETag, no key sprawl.

## Phase 3 — Universal search + knowledge (P1)
- Aggregator: files + memory + knowledge + GitHub + Drive. Intent → source selection → parallel retrieval → ranking.
- Knowledge ingestion: PDF/DOCX/PPTX/XLSX/CSV/MD/code/URLs with chunk/embed/rerank/cite. Keep knowledge ≠ memory.

## Phase 4 — Hardening (always)
- Webhooks (github.push/PR/issue, calendar, gmail) with signature validation → event bus.
- Fallback (provider A → B), backoff, cost dashboard, privacy modes (local/hybrid/cloud/strict).
- Skill versioning (pin per project), audit logs (no secrets), observability dashboard (real state).

## Non-goals
- No blind install of every public API. Right capability for task (§63).
- No second DB for API system — reuse SQLite + vault_meta.
- No voice/avatar/UI change. Same Myraa, greater capability.
