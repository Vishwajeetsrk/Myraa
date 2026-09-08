# MYRAA v6 APEX — Restoration & Real-Implementation Report

**Date:** 2026-09-04 · **Scope:** Full audit → repair → reconnect → verify of the MYRAA desktop app (`D:\Team of Vishwajeet\MYRAA`, Electron shell + Node backend + frozen Python desktop agent).

---

## 1. What was broken

**Frontend (`resources/app/dist/myraa_v6_app.js` — the visible UI):**
- Chat sent nothing: messages were echoed with a canned "Initiated autonomous cognitive task" reply (no network call).
- Voice mic button was a CSS animation only (no getUserMedia, no recognition).
- Volume slider posted `set_volume`, an action the backend did not implement → every move 400'd silently.
- Screenshot button called an unrelated endpoint (`/api/desktop/verbal-evaluate`) and always alerted success. Nothing was captured.
- "Active Capabilities" panel and every badge were hardcoded `Active >` strings.
- Recent Activity (right panel + Activity view) was a hardcoded fiction ("Analyzed UI video — 2 min ago").
- Memory view fetched real data and then **ignored it**, rendering 4 canned memories; delete was `alert()`.
- Files view was 4 hardcoded paths. Integrations claimed CONNECTED accounts ("zero fake connections" subtitle notwithstanding).
- Automation ran nothing (server stamped `lastRun` and fabricated logs).
- Learning: research returned canned 5-step reports with fabricated arXiv citations; GitHub analyzer returned fixed stats (filesCount 142) for any input.
- Settings was static HTML. App Studio's "+ New Application" and its tabs were dead.
- `ICONS.layout` was used 3× but never defined → literal "undefined" text in the top bar and cards.
- The nav badge claimed "71" skills; the header claimed "71 Verified" (real registry: 4).
- Greeting was hardcoded "Good evening, Vishwajeet." regardless of time/user.
- `installer.html` (the "MYRAA Setup" wizard) was pure theater: 8 stages advanced by `setTimeout`, no checks, `myraa://launch` protocol nothing registers, and `window.electronAPI` a preload-never-exposed API.
- The older React "holographic Gemini Live" app was loaded underneath the v6 shell and permanently hidden (`#root{display:none}`) — dead weight.
- CSS had **no SVG sizing rules at all** → bare `<svg>` defaults (300×150) exploded the omnibar ("search bar oversized" issue).

**Backend (`dist/server.cjs` + `apex_v5_routes.cjs`):**
- Mock endpoints: `/api/research/start`, `/api/github/analyze`, `/api/integrations`, `/api/automation/*`, `/api/self-improvement/*`, `/api/vision/analyze-video`, `/api/iot`, `/api/plugins`, `/api/progress/current`.
- `/api/system/control` had no `set_volume`/`get_volume`/`screenshot` actions.
- No text-chat endpoint at all (only the Gemini Live WebSocket).
- `express.json()` default 100 KB limit → real image uploads would 413.
- `apex_v5_routes` was mounted twice.
- Fish Audio API key hardcoded in a shipped file; legacy vault.json stores plaintext secrets.

**Electron:** no window-control IPC for the custom title bar (close used `window.close()` luck; minimize faked via HTTP). Black window on some display stacks (GPU compositing).

## 2. What caused the breakage

The v6 "APEX" UI was written as a visual shell against imagined endpoints (a redesign that stopped before wiring), while the real backend (recovered TS + bundle) kept its own route set. Nobody bridged them; the redesign also overlaid itself on top of the previous React app instead of replacing it.

## 3. What was restored

- **Chat → real Gemini**: new `POST /api/chat` (system persona, 12-turn context, quota-aware errors). Verified end-to-end — real API round trip, real 429 surfaced honestly.
- **Voice mic → real speech input**: Chromium SpeechRecognition → transcript → chat pipeline → spoken replies via speech synthesis. States reflected honestly; unavailable = told, not faked.
- **Volume**: real `set_volume`/`get_volume` via the frozen desktop agent (`setVolume`, exact %), PowerShell key-step fallback with an honest "approximate" message; slider syncs from the system at boot; mute button bound.
- **Screenshot**: real capture (Electron `desktopCapturer` IPC → PowerShell GDI fallback), saved to `%APPDATA%\MYRAA AI OS\recordings\screenshots`, preview modal with **Analyze with AI** (real Gemini vision) and Open Folder. Verified: real JPEG of the actual desktop, on disk, in the modal.
- **Brightness**: real WMI read/write at boot; unsupported displays say "unsupported".
- **Active Capabilities panel**: live-probed statuses (`/api/capabilities/status`): ACTIVE / DEGRADED / NOT_CONFIGURED / OFFLINE with real detail and last-activity. Browser Agent correctly went OFFLINE when DNS was blocked; back to ACTIVE with the HTTP-fallback probe.
- **Activity ledger**: every real action (chat, screenshots, research, automation, memory edits, session boot) is appended to `activity_log.json`; the Activity view and Recent Activity panel render it.
- **Memory view**: real `/api/memories` CRUD (add with category, delete with confirm) over the user's actual memory store.
- **Files view**: real directory browsing (`/api/fs/browse`) with navigation, sizes, file viewer (`/api/fs/read`), open-with-default-app (`/api/fs/app-open`).
- **Integrations**: only probed truths — Gemini key state, agent health (tools online), Fish Audio, Git, ADB (honestly NOT_INSTALLED), DNS/HTTP network, vault entry count.
- **Automation engine**: real workflows (`automation_workflows.json`) with action execution via the agent/PowerShell, execution history, enable/disable/delete, interval scheduler, workflow builder UI. Verified: created and ran a real workflow through the UI.
- **Research engine**: real async pipeline — DuckDuckGo search → read top-5 sources → Gemini synthesis (extractive fallback honestly labeled) → live step progress + real source links. Verified: 5 sources found, 4 read, 4,256-char synthesized report.
- **GitHub/repo analyzer**: real metadata for remote repos (GitHub API: meta, languages, tree, readme, manifests) and local paths (bounded fs walk) + honest AI-synthesis labeling. Verified on `src-tauri`.
- **Self-improvement**: proposals derived from real diagnostics (agent offline, key missing, ADB missing); approving the agent proposal really respawns the frozen agent; the key proposal correctly says it needs the user.
- **Skills view**: two real registries — 4 executable runtime skills (with real `/api/skills/execute` runs) + N ingested `.agents/skills` entries; header/badge show true counts.
- **Settings**: real `/api/settings` persistence (autoStart applies for real via the agent), `/api/config` key status, `/api/config/apikey` (validated against Google before saving), identity rename via `/api/identity/rename`.
- **App Studio**: "+ New Application" → real `AppStudioEngine.createProject` (PRD + scaffold), tab logic (Live Preview / PRD via real file read / Code via real listing). Verified: project created and listed.
- **Installer → real first-run setup**: every "Install" step is now a real probe (backend health, agent status, microphone grant, brightness support, key state) writing `onboarded` to settings.json; Complete screen shows the verified capability table; Launch navigates into the app.
- **Window controls**: real IPC (`window:minimize/maximize/close`) via `window.myraaDesktop` from the preload.
- **Immersive Live Voice mode** (new): top-bar toggle swaps to the previously buried React app — the real Gemini Live WebSocket + 3D avatar — instead of running it dead underneath.

## 4. What is fully working (verified live)

Chat round-trip · capability probes · memory CRUD · file browse/read/open · integrations probe · workflow create/run · research pipeline · repo analyzer · screenshot capture+save+preview · settings load/save · identity greeting · App Studio create · installer probes · window controls · metrics · clipboard · record (browser) · power modal · brightness (WMI) · SVG icon system.

## 5–7. Permissions / hardware dependencies / unsupported

- **Needs OS permission:** microphone (voice input), screen capture (screenshots/vision), autostart (agent).
- **Hardware-dependent:** brightness (external monitors unsupported — UI says so), exact volume read (agent-only; without it, stepping fallback is approximate).
- **Unsupported without extras:** ADB features (not installed — reported, not faked), video frame analysis (no extractor; the old fake PRD endpoint is shadowed and the UI never calls it).
- **Quota-bound:** all Gemini features (chat, vision, research synthesis, memory consolidation) — real errors surfaced with retry guidance.

## 8. Remaining limitations

- Python agent **source** is not in the repo (frozen exe only) — the Node tool contract in `server.ts` is the rebuild spec.
- Legacy `vault.json` (older v5 module) stores plaintext secrets; Fish Audio key remains in `apex_v5_routes.cjs` (still functional; migrate to keyring later).
- The fake v5 endpoints still exist *behind* the overlay (shadowed for the paths the UI uses); they should be deleted when no other client depends on them.
- React app still mounts at startup (hidden) — costs a little memory; could be code-split out later.
- `src-tauri` (Tauri shell) is a parallel, unreleased build path — untouched in this pass.

## 9. Architecture (as restored)

```
MYRAA.exe (Electron shell, main.cjs)
 ├─ spawns dist/server.cjs (Node/Express :3000, ELECTRON_RUN_AS_NODE, IPC capture channel)
 │   ├─ myraa_v6_real_routes.cjs  ← NEW overlay, mounted FIRST (real endpoints)
 │   ├─ apex_v5_routes.cjs        ← legacy engines (office, skills-mcp, diagnostics…)
 │   ├─ cognition runtime (Gemini Live /live WS, autonomous mind, structured memory)
 │   ├─ api-hub, model router (@google/genai, key: secrets.json → env)
 │   └─ → frozen Python agent 127.0.0.1:8765 (~70 real Windows tools; PowerShell fallback)
 ├─ renderer: dist/index.html
 │   ├─ myraa_v6_app.js  (desktop OS shell — all views wired to real endpoints)
 │   └─ React bundle     (Immersive Live Voice mode; hidden on desktop shell)
 └─ preload.cjs (window.myraa capture bridge, window.myraaDesktop controls)
Data: %APPDATA%\MYRAA AI OS\  (settings.json, secrets.json, memories.json,
      activity_log.json, automation_*.json, research_*.json, recordings/, cognition/)
```

## 10. Test results (this session, live app + CDP-driven real clicks)

| Area | Result |
|---|---|
| Boot (server, agent, window) | PASS — all 8 capabilities probe ACTIVE |
| Chat send → Gemini | PASS (real API; free-tier 429 surfaced with retry hint) |
| Screenshot → save → modal | PASS — real desktop JPEG on disk via desktopCapturer |
| Screenshot → Analyze with AI | PASS pipeline (real request; 429 quota message shown) |
| Volume get/set | PASS via agent contract + honest fallback |
| Capabilities view | PASS — 8 cards, live statuses |
| Skills view | PASS — 4 executable + ingested catalog, true counts |
| Memory view | PASS — real user memories, add/delete |
| Files view | PASS — real dirs, navigation, sizes |
| Integrations view | PASS — probed states incl. honest NOT_INSTALLED/EMPTY |
| Automation create+run | PASS — real execution + history |
| Learning proposals | PASS — from real diagnostics |
| Research pipeline | PASS — 5 sources, synthesis, live steps |
| Repo analyzer | PASS — real tree/languages/manifests (local + remote) |
| App Studio create | PASS — project scaffolded + listed |
| Settings | PASS — real values, key status, identity rename |
| Installer checks | PASS — real probes, honest log |
| Window controls | PASS — IPC handlers registered |

*Known cosmetic note: on some capture paths the window paints black while the renderer is fine (verified via renderer-side CDP screenshot); hardware acceleration is now disabled to avoid this on VM/RDP display stacks.*

---
## 2026-09-04 � Vision-overlay restore + perf pass
- Symptom: [MYRAA VISION AWARENESS] window-change narration rendered as giant center text covering the avatar (model violated server.cjs:6010 rule 19: never utter tags, 1-2 sentences max).
- Fix: ui-health-patch.js vision guard (MutationObserver): strips tag via existing sanitizeText, collapses window-change spam to 'Noted: <place> � full note in Transcripts' with full text preserved via addTranscriptTurn, clamps any caption >240 chars to 2 sentences. node --check clean for both patched JS files.
- Restart: stopped MYRAA.exe 22124 + orphan myraa-agent 2604 (159 CPU-s), relaunched via Start-MYRAA.bat -> MYRAA.exe 12916, agent 22116 (health: 64 tools ok), backend 200 on :3000, served patch verified to contain visionGuard.
- Perf: old session GPU 364+301MB after ~27h; fresh boot warmup spike ~1.1GB shader/VRM compile, settles. Single-instance healthy (one MYRAA.exe). No errors.log present (no backend exceptions). Cognition tick ~3s by design, cheap.
- Residual: model verbosity is prompt-adherence (needs presence-cooldown tuning in server bundle); frontend guard contains the symptom regardless.
