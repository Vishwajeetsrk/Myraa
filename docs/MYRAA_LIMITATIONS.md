# MYRAA Limitations (truthful, 2026-11-18)

This file lists what MYRAA **cannot** currently do. None of these are presented as working in the UI.

## Not implemented
- OAuth for any connector (GitHub, Google/Gmail/Calendar, Microsoft Graph, Salesforce, Canva, Figma). Current connectors use environment keys only.
- Video analysis/editing engine. `ffmpeg` is probed by the capability gap analyzer, but no adapter, renderer or output validation exists.
- Skill lifecycle (install/update/remove) and per-skill self-tests: 717 skills catalogued, 715 manifests verified. Bounded execution exists for skills with real scripts (`skill_runner.cjs`, `/api/skills-runner`), but instruction-only skills still cannot be "executed", and install/update/remove are not implemented.
- MCP http transport, resources and prompts: stdio tools only; those endpoints honestly return `NOT_IMPLEMENTED`.
- Microsoft Word/Excel/PowerPoint deep visual editing: document generation/review exists, but live open-document visual modification and chart/dashboard automation are not verified.
- Application Adapter Registry live editing: 16 adapters now detect real windows and expose real UIA inspect/read/locate/verify (`/api/application-adapters`), but per-app edit/create/execute bridges are not implemented.
- Parallel worker isolation and durable workflow resume: `parallel_runner.cjs` now runs a bounded pool with a dependency graph over real module functions (`/api/parallel`), but it has no worker-thread/process isolation and does not resume jobs after restart. A multi-app durable workflow engine is still absent.
- Computer runtime abstraction (sandbox/Docker/remote): not started.

## Partially implemented
- Screen Intelligence: normalized context + target resolver work, but no vision-model routing, no change detector, no semantic screen tree, consent is off by default in dev.
- Browser agent: real launch/navigate/screenshot works via playwright-core + system Chrome; DOM inspection, uploads, profiles and approval-gated form submission routes are not built.
- Agents: 28 real agents + delegation, but live model-backed delegation requires configured providers and is not verified end-to-end.
- Memory: 4 stores, one real overview, but no unified logical MemoryFacade; SQLite row counts are honestly `null`.
- Voice: real WS events drive avatar state labels; mic selection, input level and full audio diagnostics are not implemented.
- Compiled React settings/skills/connector cards still contain static values because the original UI source is not in this repo. Runtime addons correct only detectable badges.

## Environment / external dependencies
- Installers unsigned: SmartScreen warning until an EV code-signing certificate is configured (external purchase required).
- Electron permission allowlist now denies unknown permissions; individual site-level consent UX is not built.
- `secure_vault.cjs` still passes secrets via `cmdkey` command line and uses a fallback salt; credential hardening is pending.
- Plugin manager loads manifests without signature verification or sandboxing.
- REA-based source recovery of the compiled React bundle requires a Linux x64 worker with `prlimit` + Wakaru.

## Performance
- Screen observation is on-demand only; no perceptual-hash change detection or adaptive sampling yet.
- Design tokens exist in overlays; legacy stylesheet still contains many hardcoded hex colours and sub-11px text (66 findings from Design Doctor).

## Distribution
- All recent work is source-only. The shipped v9.6.3 installer does not contain capability registry gaps, screen intelligence, real icons or settings workspace. A v9.7.0 build is required; no installer is claimed production-ready until built and verified.
