# MYRAA Capability Matrix (runtime-verified)

Generated: 2026-11-18 · Source version: 9.6.3 · All work below is source-only until a new installer is built.

Statuses are from real runtime checks (`/api/capabilities`, `/api/health-manager/run`, capability self-tests). No UI label is treated as evidence.

| Capability | Implementation | Backend / API | Health / test | Status | Missing requirement |
|---|---|---|---|---|---|
| Desktop host | Electron 31 shell; consent-gated capture | IPC + `/api/health` | install smoke, verifier | IMPLEMENTED | signed build (EV cert) |
| Capability registry | `agi/capability_registry.cjs` + bootstrap (12 subsystems) | `/api/capabilities` | 16 checks | VERIFIED | React consume live |
| Health manager | `health_manager.cjs` | `/api/health-manager/run` | 11 real probes | VERIFIED | mic/GPU probes |
| Diagnostics | `diagnostics_center.cjs` | `/api/diagnostics-center` | 20 checks + report | VERIFIED | none for current scope |
| Provider routing | `ai_provider_manager.cjs` + real Gemini adapter | `/api/providers`, `/api/chat` | 17 checks, live chat reply | VERIFIED | Anthropic chat adapter; full stack consolidation |
| MCP stdio | `mcp_manager.cjs` + `mcp_manager_v2.cjs` | `/api/mcp`, `/api/mcp-v2` | real probe 207 tools (REA) | VERIFIED | http transport, resources, prompts |
| Skills | `skill_registry.cjs` (717/715) + `skill_runner.cjs` (bounded executor) | `/api/skills-v2`, `/api/skills-runner` | 14 + 17 checks | PARTIAL | install/update/remove, instruction-only execution, self-tests |
| Connectors | `connector_registry.cjs` (8 env-key connectors) | `/api/connectors-v2` | 9 checks | PARTIAL | OAuth (Google/GitHub/Graph/Salesforce/Canva/Figma) |
| Actions | `action_registry.cjs` (47 derived actions) | `/api/actions` | 11 checks | VERIFIED | execution bindings for every action |
| Approvals | `approval_manager.cjs` over broker/workspace | `/api/approvals` | 10 checks | VERIFIED | in-app approval cards |
| Screen Intelligence | `screen_intelligence.cjs` (UIA/OCR/capture) | `/api/screen-intelligence` | 14 checks, consent gate | PARTIAL | vision routing, change detector, application adapters |
| Action verification | `action_verifier.cjs` | `/api/action-verification` | 12 checks, approval gate | VERIFIED | more executors |
| Browser agent | `browser_agent.cjs` + playwright-core + system Chrome | `/api/browser/*` | 11 checks, live start/navigate | VERIFIED | DOM inspection routes, uploads, profiles |
| Tasks | `task_engine.cjs` (7-state durable machine) | `/api/tasks` | 17 checks | VERIFIED | parallel worker pool |
| Agents | `agent_delegation.cjs` over 28 real agents | `/api/agents-v2` | 13 checks | PARTIAL | live provider delegation |
| Memory | 4 physical stores, real overview | `/api/projects-v2` | 13 checks | PARTIAL | unified MemoryFacade, SQLite in-process count |
| Voice/avatar | real WS events → state labels; 3D model untouched | `/api/avatar`, `/api/live/status` | 16 checks | PARTIAL | mic selection, input-level diagnostics |
| UI polish / shell | design tokens, HUD, Capability Center, Ctrl+K, Settings Workspace | static assets | 19+13 checks | VERIFIED | compiled React source recovery |
| Design Doctor | `design_doctor.cjs` (66 evidenced findings) | `/api/design-doctor` | 15 checks | VERIFIED | act on findings |
| Real icons | `@thesvg/react` (7,681 SVGs) | `/api/icons` | 21 checks | VERIFIED | none |
| Capability gap analyzer | `capability_gap_analyzer.cjs` | `/api/capability-gap` | 12 checks | VERIFIED | more domain adapters |
| Office (Word/Excel/PPT) | `office_doc_engine.cjs` | existing routes | static verification | PARTIAL | charts, live visual editing, slide redesign |
| Video engine | none (ffmpeg probe only) | gap analyzer reports DEPENDENCY_MISSING | real ffmpeg probe | NOT_IMPLEMENTED | ffmpeg + adapter + validation |
| OAuth | none | gap analyzer reports CONFIGURATION_REQUIRED | real token checks | NOT_IMPLEMENTED | OAuth PKCE flow + secure token storage |

Full evidence: `docs/myraa-audit/CAPABILITY_MAP.md`, `UI_CAPABILITY_AUDIT.md`, `SCREEN_INTELLIGENCE_MAP.md`.
