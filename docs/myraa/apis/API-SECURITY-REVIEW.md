# MYRAA — API Security Review (per-integration gate)

## Gate (must PASS before connector ships)
1. Auth: OAuth/PAT via vault (keyring DPAPI). NEVER in source, NEVER in logs/UI/chat/memory/error.
2. Scopes minimal (e.g. GitHub repo-level allow-list, Gmail readonly first).
3. Permission → risk → approval: read auto / write confirm / destructive explicit / critical elevated.
4. Secrets: `.env` never committed; `vault_meta.json` holds metadata only (`has_secret`, no secret).
5. Rate limit + backoff + usage tracking; no hot retry loops.
6. Privacy: dataTypes declared; strict_private blocks cloud; local-first where possible.
7. Webhooks: signature validation → normalize → event bus.
8. Audit: user request, tool, API call, permission, approval, file/GitHub/DB write. No secrets in logs.
9. Health honesty: connected/healthy/degraded/rate_limited/unauthorized/unavailable/not_configured. Never fake-green.
10. Fallback: no invented data. Say unavailable + offer alternative.

## Current findings (2026-09-08)
- PASS pattern: Tauri vault → keyring, CONFIRM_REQUIRED outside workspace, trash instead of delete.
- FIX NEEDED: `plugin_execute` gmail/salesforce/github returns simulated ok — dashboard MUST stay PARTIAL until real REST.
- FIX NEEDED: legacy `%APPDATA%/JARVIS/vault.json` still exists (non-secret oauth entries) — delete/alias after `vault_status secure:true` from real binary.
- FIX NEEDED: Fish Audio key still in old `apex_v5_routes.cjs` — move to vault, never in dist.
- Finance: read-only first, disclaimer, no transactions without explicit permission.

## Rejected by default
- Any API requiring plaintext secrets in UI, broad org-wide scopes, or bypassing CAPTCHA/security controls.
- Any "free unlimited" claim without ToS + rate-limit verification.
