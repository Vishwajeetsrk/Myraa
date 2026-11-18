# MYRAA UI + Capability Audit (2026-11-18)

Companion to `CAPABILITY_MAP.md` and `SCREEN_INTELLIGENCE_MAP.md`. Method: read-only code inspection + live API probes. No claim here is based on a UI label alone.

## Current (implemented & verified)
- Desktop host: Electron 31 shell, backend on 3000, real IPC, consent-gated screen capture; packaged v9.6.3 installs and boots.
- Backend: 48+ mounted APIs including capabilities, health, providers, connectors, actions, approvals, MCP v2, skill registry, agents, tasks, projects, avatar state, diagnostics, screen intelligence, action verification, real brand icons.
- UI overlays: design tokens, status strip, Capability Center, Ctrl+K palette, truthful badge pass, focus rings, scrollable panels, screen-reader live region.
- Screen: normalized ScreenContext over existing UIA/OCR/capture; consent gate; semantic target resolver; action→observe→verify with receipts.
- Tests: 48 suites green at last full run; verifier 25 PASS / 0 FAIL.

## Broken / partial
- Browser agent cannot start: Playwright is not installed.
- `takeScreenshot()` returns `ok:true, image:null` on headless sessions (now honestly reported as UNAVAILABLE by Screen Intelligence).
- 5 memory stores still physically separate (one logical facade not yet built); SQLite counts reported as `null`.
- Skill execution sandbox/run not implemented; skills remain manifest-verified, not executable from MYRAA's own runner.
- MCP resources/prompts/HTTP transport not implemented (honest `NOT_IMPLEMENTED`).
- OAuth connectors not implemented; connectors use env keys only.
- HEALTH: microphone/GPU diagnostics are honestly `UNAVAILABLE`; no real probe exists.
- `/api/chat` was bypassing the AI gateway — now fixed and live-verified through the provider router.

## Fake/static values (fixed or remaining)
- Fixed: hardcoded capability catalog (`REAL`/`verified:true`/`last_tested:now`) → registry-derived; always-online `/api/agent-health` → real probe; frozen `IDLE` live status → WebSocket connection count; duplicate Apex mount removed; version fallbacks → dynamic reads.
- Remaining: compiled React settings bundle (`assets/index-*.js`) still contains static IoT/plugin/version cards (source not in repo). Runtime badge pass corrects VERIFIED/ACTIVE where detectable; full fix needs UI source recovery or a rebuilt React bundle.
- Repo `dist/screen_awareness_consent.json` is a stray pre-consent artifact (`enabled:true`) that no loader reads.

## Duplicated services (do not add more)
- 4 AI stacks (ai_gateway_service, model_router, myraa_core, model_gateway) — one provider facade now wraps the mounted gateway; full consolidation pending.
- 5 memory stores; 2 passive learners; 2 MCP surfaces (`/api/mcp` and `/api/mcp/v1`); connector catalog + 5 parallel `myraa_<name>_connector.cjs` files; Apex routes double-mounted (now reduced).
- No new capture/OCR/UIA/action engines were added in this pass — all overlays reuse existing services.

## Unsafe / security findings (P0 partially addressed)
- Electron permission handler granted everything → replaced with explicit allowlist (unknown denied).
- LAN token now required for `/api/mcp/call`, plugins execute, browser, approvals execute, terminal.
- Remaining: plugin manager loads manifests without signature/sandbox; sensitive-field detection in `universal_app_control.cjs` not enforced; `secure_vault.cjs` uses cmdkey secret on command line; several high-risk routes still lack per-action risk policy; no full audit log.

## Needs rebuild / API / UI / testing
- v9.7.0 installer containing all source-only work; signed build requires an EV certificate (external).
- UI source recovery (React bundle) for settings/skills/connectors cards; REA source recovery needs Linux x64.
- OAuth + browser runtime + skill runner + durable queue + memory facade + design doctor + HUD/Activity Center.
- UI tests for real DOM behavior; security tests for approval bypass/path traversal/command injection.

## Real icons
- `@thesvg/react@4.0.12` (MIT) installed; 7,600+ real brand SVGs. Served at `/api/icons/icon/:name` with `currentColor` mono variant; unknown names return `NOT_FOUND` (no fake logos). Attribution retained.

## Design skills ingested
- Owl-Listener/designer-skills (MIT, 111 skills), nextlevelbuilder/ui-ux-pro-max-skill (MIT), bergside/awesome-design-skills (67 skills) installed additively into `%USERPROFILE%\.agents\skills`; MYRAA's skill discovery now scans that directory. These are **design references/manifests**, not executable MYRAA skills — do not display them as ACTIVE.
