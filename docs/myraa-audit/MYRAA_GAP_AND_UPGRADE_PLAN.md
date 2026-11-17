# MYRAA gap, upgrade and self-improvement plan

Date: 2026-11-17 · Source version: 9.6.1 · Last published release: 9.5.0.

> Progress: **P0-1 DONE** (verifier modernized, 25 PASS / 0 FAIL). **P0-2 DONE** (v9.6.1 built, packed, hash-verified; packaged smoke with real REA probe 207 tools + real `tools/call` OK). P0-3 (fuses) and P0-4 (shipped React source) remain open.

Evidence for this report:
- All 25 `tests/test_*.cjs` suites run: **25 pass, 0 fail** after fixing one stale assertion in this session.
- `tests/verify_final_system.cjs`: **7 PASS / 8 FAIL** (stale, see P0-1).
- Installed app inspected with real REA (`inspect_electron_fuses` on `MYRAA.exe`, SHA256-bound).
- Existing prior audit: `docs/myraa-audit/MYRAA_ARCHITECTURE_AUDIT.md`, `MYRAA_RISK_REGISTER.md`.

## 1. What is working (verified)

| Area | State |
|------|-------|
| Backend + mounts | Express server on 3000, all phase mount logs clean; permissions + MCP 6 agi tools |
| Test suites | 25 plain-Node suites exit 0; documented total 318 checks across 10 suites + auxiliary |
| MCP | Real stdio transport (handshake / tools/list / approval-gated tools/call), 8 presets incl. REA (207 real tools live-verified), honest `NOT_IMPLEMENTED` for http |
| Voice / 3D / desktop | Gemini Live loop, wake word, OCR/vision, desktop control, protected avatar untouched |
| Memory / learning | Episodic + SQLite bridge (single JSON line dispatch), passive UI recorder, `/api/learn/web|github`, mistake learning, RAG ingest |
| Autonomy stack | Evidence, investigation (8 skills incl. 4 REA), workspace, connectors, model gateway, safety broker, event bus, timeline, permissions |
| Installers / release | v9.5.0 Setup + Portable packed, hash-verified, silently installed, GitHub Release live (4 assets) |
| UI pass (this session) | WCAG AA token pass (19 pairs, 0 failures), input focus state, animated shadcn bell wired into AURELIA dashboard, animation libs deduplicated: bundle 557 KB -> 436 KB (gzip 178 -> 139 KB) |

## 2. What is broken, stale or pending

**P0-1. `tests/verify_final_system.cjs` is stale (7 PASS / 8 FAIL).** Hardcodes version 9.3.0, old `release/` paths and a server-state assumption that v9.4+ intentionally violates. Known in the two audit docs. Modernize to read `version.json`, use the current dist paths and start its own server on a test port, or retire it in favour of the 25 suites.

**P0-2. Shipped installers are behind source.** v9.5.0 does not contain: the `rea` preset, `MAX_TOOLS=300`, the AA design-token pass, or the new UI component. Needs a v9.6.0 build + pack + hash + install smoke.

**P0-3. Electron fuses are in default (weak) state** - measured by REA on the installed `MYRAA.exe` (PE x86_64, sha256 `5707f628804e5ac5bac32a3935aba9f95e6f8dac05559969e3d9fd853c7c5d1f`):
- `RunAsNode`: enabled, `EnableNodeOptionsEnvironmentVariable`: enabled, `EnableNodeCliInspectArguments`: enabled, `GrantFileProtocolExtraPrivileges`: enabled
- `EnableCookieEncryption`: disabled, `EnableEmbeddedAsarIntegrityValidation`: disabled, `OnlyLoadAppFromAsar`: disabled
- Caveat: the app spawns its backend with `ELECTRON_RUN_AS_NODE=1`, so flipping `RunAsNode` needs a separate node binary or a server-in-main refactor first. Do not flip blindly.

**P0-4. Dashboards are not the shipped UI.** `resources/app/dist/assets/index-*.js` is the compiled React app but its source is not in the repo. The new shadcn bell lives in `Projects/Website Design/agon-agent[myraa dashboard]` (a design project). To land React UI changes in installers you need either the original source restored or a source-recovery/package workflow. Attempted REA `recover_javascript_sources` on the bundle: that tool requires Linux x64 with Wakaru and `prlimit`, unavailable on this Windows host - recovery remains blocked until a Linux worker or the original source exists.

**P1-5. MCP http transport is unimplemented** (honest `NOT_IMPLEMENTED`). Stdio is real; http needs an HTTP/SSE client session manager.

**P1-6. Observability UI missing.** Event bus + timeline exist in backend/API; no dashboard surfaces wired into the front end.

**P1-7. No durable queue and no global WebSocket broadcast** (from architecture audit). Jobs live in memory Maps / snapshots; `/live` sends per-connection only.

**P1-8. Unsigned installers** - SmartScreen warning until an EV code-signing certificate is configured.

**P1-9. Weak CI gate.** No framework runner; convention is plain Node scripts plus `npm run myraa:architecture-check`. No automated nightly run of the 25 suites.

**P2-10. Stale assertion fixed this session:** `tests/test_investigation.cjs` asserted exactly 4 investigation skills while the catalog has 8 (4 REA skills added earlier). Now asserts core + REA ids (`>= 4`), future additions will not break it.

## 3. Upgrade plan by what you asked for

### More personal
- Preference profile in `%APPDATA%\MYRAA\` (voice name/style, wake phrase, units, theme, working hours, nicknames), exposed as a settings API and read at boot by the persona + UI.
- Personal memory write-back: after every completed task, store a short episodic record with topic, decision, outcome and user preference; recall it on the next related task (memory already exists, wire the loop).
- Per-user skill enable/disable; keep the protected 3D companion and voice identity untouched.

### More working / reliable
- v9.6.0 rebuild pipeline (build -> hash -> pack -> silent install -> MCP smoke) for every release.
- Durable job queue backed by the existing SQLite bridge; retry/backoff/dead-letter; resume after restart (GoalManager already has a durable DAG template).
- Wire timeline/events into an observability page; it makes every autonomous action inspectable.
- Modernize `verify_final_system.cjs` into a real pre-release gate; run all 25 suites in CI/nightly.

### Earning
- Use the installed `replica-entrepreneur` skill: mine public reviews of comparable products, rank complaints/missing features, turn the top gap into a positioning angle.
- Meter usage with the existing model gateway cost table: free local tier + paid cloud-model tier + paid MCP connector pack; keep secrets server-side.
- Ship a plugin marketplace (plugin_manager already loads `plugin.json` + `index.cjs`) with a review/approval gate.
- Landing page + store listing via `replica-launch`; licensing/legal before charging.

### Automation
- Scheduler over GoalManager: daily/weekly routines, approval-gated HIGH/CRITICAL tools via the safety broker, event-triggered workflows (event bus -> action).
- Chain MCP tools: `mcp_probe` -> `mcp_call` with approval; REA gives real reverse-engineering actions already.
- Recover the `onChat` plugin hook (currently dormant per audit) or replace with explicit event bindings.

### Fast learning
- Skill-ingest pipeline (see below): discover -> verify -> install -> test -> promote.
- After each task, emit an evaluation record: intent, chosen tool, result, user correction; nightly job turns repeated corrections into a rule or skill.
- RAG ingest for docs/repos already exists in `memory_kb.cjs`; add a "learn this GitHub repo" command that clones to a temp dir, builds a skill from its README, and registers it with provenance.

### Thinking / brain / correctness
- Golden-task eval set for intents and tool selection; run it on every change to `coding_orchestrator.cjs` (30+ intents today).
- Two-pass answer pattern: draft -> verifier pass that checks evidence and confidence; keep the existing "honest errors / no fabricated data" contract.
- Model router already supports task-type routing + fallback; add a quality score per lane and pick by measured correctness, not just price.
- Add regression tests whenever a wrong answer is corrected (the mistake-learning engine already stores the mistake; turn it into a test).

### Learning skills from GitHub (concrete loop, proven this session)
1. Clone the repo to a temp dir, read README/LICENSE, refuse non-OSI licenses or unknown provenance.
2. Install additively into `C:\Users\Vishwajeet\.agents\skills\` (never overwrite without backup).
3. Validate each `SKILL.md` and run its tools on a small real task (we did this with `replica-design`: it found 3 real WCAG failures).
4. For services, register an MCP preset and verify with a real `probe` + real `tools/call` before exposing it to voice (we did this with REA: 207 tools + fuse inspection).
5. Write a provenance entry (source URL, version/commit, license, verification date) into a skills registry doc; promote or remove based on measured value.

Applied this session: `rea` (MCP preset + live verification), `replica-skill` (11 skills installed, recon/design method used), `@animate-ui/icons-lucide-bell` (shadcn registry install -> wired -> built).

## 4. Recommended order

1. P0: modernize the stale verifier, rebuild v9.6.0 with all unreleased changes, fuse assessment (do not flip RunAsNode).
2. P0: recover or reconstruct the shipped React source so UI work reaches installers.
3. P1: observability UI, durable queue, http MCP transport, nightly CI.
4. P1: personal preference profile + memory write-back loop.
5. P2: skill-ingest script + registry, eval/golden-task harness, earning/positioning work via replica skills.
