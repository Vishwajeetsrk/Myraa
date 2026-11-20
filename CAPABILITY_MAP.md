# MYRAA Universal Work Agent - Capability Map

Date checked: 2026-11-20
Method: source inspection plus live tests recorded in this session.
This document is a status record, not a promise. A capability is called VERIFIED only when code exists and a live test passed.

## Status legend

| Status | Meaning |
| --- | --- |
| VERIFIED | Code exists and a live or unit test passed in this session. |
| EXISTING | Present in the repository, inherited from earlier work; not re-verified here. |
| PARTIAL | Some of the requested surface exists; named gaps remain. |
| FRAMEWORK | Structured reasoning scaffold only. No research or execution is performed by it. |
| NOT_IMPLEMENTED | No working code found. |
| CONFIGURATION_REQUIRED | Needs owner credentials, DNS, payment setup, or external approval. |

---

## 1. Verified in this session

| Spec area | Implementation | Status | Evidence |
| --- | --- | --- | --- |
| Desktop window/monitor/focus control (sections 24, 46) | `ui_automation_runner.ps1`, `ui_automation_service.cjs`, `/api/desktop/state`, `/foreground`, `/monitors`, `/focus`, `/find`, `/window/action` | VERIFIED | Live: 1 monitor 1920x1080 after DPI fix; 10 windows; Excel foreground; ambiguous resolution and close guard returned `AMBIGUOUS` / `APPROVAL_REQUIRED`. |
| Screen session + activity inference (sections 46, 58) | `live_awareness_routes.cjs`, `event_bus.cjs`, `passive_learning_service.cjs` | VERIFIED | Live: session start/observe/action/stop, password redaction, private-mode gate, consent revocation halts capture, `screen.*`/`app.*`/`window.*`/`workflow.*` events accepted. |
| Live Excel operation (section 2) | `excel_bridge_runner.ps1`, `excel_bridge.cjs`, `/api/excel/*` | VERIFIED | Live COM attach to running Excel; workbooks/sheets/info/read/write/formula/format/chart/add-sheet/rename/save/close all passed on a throwaway workbook; user's workbook untouched; guards returned honest codes. |
| Legacy Excel write safety (section 2) | `/api/desktop/excel/write` in `apex_v5_routes.cjs` | VERIFIED | Now delegates to the bridge with JSON transport; no script interpolation; missing workbook returns `WORKBOOK_NOT_FOUND`. |
| VBA explanation/review/rewrite (section 3) | `vba_analyzer.cjs`, `vba_routes.cjs`, `/api/vba/*`, voice intents | VERIFIED | Spec's `header` macro: 5 labels explained, `Donation Onwer` caught, 9 findings, safe rewrite generated with `H1:L1`, no `.Select`, no `FormulaR1C1`, error handler added. Complex macro correctly refused rewrite. |
| Business awareness (sections 36-38, 60) | `business_os.cjs`, `/api/business/*`, business voice intents | VERIFIED | Earlier this project: 20 real leads, honest zeros, path-escape blocking, all routes HTTP 200. |
| Reasoning frameworks (sections 9-17, 22, 28-30, 37-41, 51-52, 59-60) | `reasoning_frameworks.cjs`, `reasoning_routes.cjs` | VERIFIED | 17 frameworks plus plans/legal/report/decision. All fields UNKNOWN by default; India checklist has 25 items all `Unclear` with `NOT_CHECKED`. |
| Honest capability reporting (section 59) | `capability_gap_analyzer.cjs` | VERIFIED | Reports `office.excel_live`, `office.vba`, `reasoning.frameworks`, `workflow.skill_compiler`, `system.controls` with real evidence; `office.excel` remains PARTIAL. |
| Workflow-to-skill compiler (sections 11-13, 22, 44-46) | `workflow_skill_compiler.cjs`, `/api/workflow-skills/*`, voice intents | VERIFIED | Live session candidate -> compile (APPROVAL_REQUIRED + token) -> explicit confirm -> edit (version bump) -> dry run (no changes) -> publish into existing skill registry -> run recording -> improvement from failure. Replay execution is explicitly NOT_IMPLEMENTED. |
| System control matrix (sections 26-27, 55) | `system_control_matrix.cjs`, `/api/system-control/*`, voice intents | VERIFIED | 27 controls with honest statuses (Supported/Partial/Requires confirmation/Requires elevation/Not implemented); reuses existing volume and token-gated power helpers; power actions require a token; destructive actions were not executed during testing. |
| Client discovery (sections 15-20, 39) | `client_discovery.cjs`, `/api/client-discovery/*`, voice intents | VERIFIED | Evidence reconciliation, real public-URL probe, mandatory "Website: Not found" / "Phone number not verified", source URLs, confidence labels, verified 17-column Excel writeback with readback. Tests D + E pass. |
| Skill replay + Action Center (sections 23-25, 48, 58) | `skill_replay.cjs`, `/api/skill-replay/*`, `action_center.html`, voice intents | VERIFIED | Real opt-in action handlers, step/run, pause/resume/stop, audit traces, unsupported actions fail closed, additive live UI page. Test C passes for supported actions. |
| Deep Excel operations (section 10) | `excel_bridge.cjs`, `excel_bridge_runner.ps1` | VERIFIED | Sort, autofilter, tables, named ranges, data validation, conditional formatting, sheet activation, column insert/delete with guard, verified on a throwaway workbook. |
| IDE state + telemetry (sections 24, 40, 54) | `ide_state.cjs`, `performance_telemetry.cjs` | VERIFIED | Read-only git/UIA composition, diagnostics honestly NOT_IMPLEMENTED; latency and failure counters with event emission. |
| Cross-app, legal, background, screen-share, readback (sections 7, 28, 34, 39-40, 55) | `cross_app_orchestrator.cjs`, `legal_research.cjs`, `background_research.cjs`, `screen_share_status.cjs`, `system_control_matrix.cjs` | VERIFIED | Office files generated end-to-end; official-source fetch with URL/date; background jobs reuse existing parallel runner; sharing state NOT_VERIFIED; Wi-Fi/Bluetooth readback real. |

## 2. Existing systems reused, not replaced

| Spec area | Existing system | Status |
| --- | --- | --- |
| Female 3D companion, animations, eye tracking, camera controls | Existing renderer and model assets | EXISTING - untouched |
| Voice loop, wake phrase, microphone, VAD | Existing voice stack | EXISTING - untouched |
| Memory and recalls | `memory_core_service.cjs`, episodic store | EXISTING - extended by awareness, not duplicated |
| Skills, agents, job queue, parallel runner | `skill_registry.cjs`, `skill_runner.cjs`, `task_engine.cjs`, `parallel_runner.cjs` | EXISTING - reused |
| MCP connectors | `mcp_manager.cjs` | EXISTING - reused |
| Browser agent | `browser_agent.cjs` | EXISTING - reused |
| Screen awareness / OCR / vision | `screen_intelligence.cjs`, `ocr_engine.cjs`, vision routes | EXISTING - extended |
| Application adapters | `application_adapters.cjs` | EXISTING - reused |
| Coding orchestrator, git, tests, terminal | `coding_orchestrator.cjs`, `git_service.cjs`, `test_runner_service.cjs`, `terminal_runner.cjs` | EXISTING - reused |
| Word engine / document automation | `office_doc_engine.cjs` and Word routes | EXISTING - not re-verified this session |
| Video intelligence | `video_engine.cjs` | EXISTING - not re-verified this session |
| Excel file analysis (offline) | `excel_intelligence.cjs` (openpyxl) | EXISTING - complemented by the live bridge, not replaced |

## 3. Frameworks the agent follows (not executions)

These are now code-backed response structures at `/api/frameworks`. They produce questions and sections; they do not produce facts.

- Website reality check: user, problem, value, differentiation, trust, friction, conversion, payment, retention, failure (section 9).
- Reality check: strongest reason to build, strongest reason not to build, evidence, cheapest validation, all major risks, MVP and what to remove (section 51).
- PRD: 27 sections from problem through acceptance criteria (section 10).
- Plans: 1 hour / 1 day / 7 day scaffolds, explicitly not promises (section 11).
- SaaS user reality, weakness audit, "what will break", security review, threat model, privacy review, contract review, AI product review, agent security boundaries, research plan, "do we need to build", bug report, repo health, prioritization (sections 13-20, 28-30, 42-45, 48-50).
- Legal awareness output: jurisdiction, business model, data, users, transaction, current official sources, date checked, uncertainty, professional review (sections 39-41).
- Final task report and master decision rule (sections 60, 62).

Evidence discipline: `Found / Verified / Inferred / Estimated / Suggested / Unknown / Not found / Unsupported / Failed / Partially completed`. Supplied values become `PROVIDED`; everything else stays `UNKNOWN`.

## 4. Honest gaps

| Spec area | Status | What is actually missing |
| --- | --- | --- |
| Advanced Excel: pivots, slicers, conditional formatting, data validation, filters/sorting, merged cells, hyperlinks, comments, external links, named ranges, Power Query, Power Pivot, DAX, VBA execution, Office Scripts, PDF export, print layouts | PARTIAL | Bridge covers workbooks, sheets, ranges, values, formulas, formatting, charts, sheets, rows, save/open/close. The listed features are not built or verified. |
| Excel CSV/template workflows | PARTIAL | `excel_intelligence.cjs` handles offline workbooks; CSV is intentionally handled by `business_os.cjs` with its own parser. Template workflows not built. |
| Word live visual verification, tracked changes, mail merge, captions, citations | PARTIAL | Document generation/review exists; live visual verification and the listed advanced features are not verified. |
| PowerPoint redesign, masters, themes, animations, transitions, speaker notes | PARTIAL | Generation exists; redesign and the listed features are not verified. |
| Cross-application Excel to Word to PowerPoint to browser workflow | PARTIAL | Orchestrator verified end-to-end: research, Excel, Word and PowerPoint files generated. Outlook draft remains NOT_IMPLEMENTED and is reported as such. |
| Website design from screenshots/Figma/references | NOT_IMPLEMENTED | Existing site generator handles natural-language builds; screenshot/Figma ingestion not built. |
| Live legal/compliance research with current official sources | PARTIAL | Official-source allowlist fetches real pages with URL and date checked. No compliance claim, no interpretation; applicability stays `Unclear` and professional review Required. |
| Background research operations | AVAILABLE | Submits jobs into the existing bounded parallel_runner with progress, cancellation and evidence composition. No second queue. |
| Repository health, code review, A/B, deployment, observability, maintenance, scale modes | FRAMEWORK + PARTIAL | Structured checklists exist; automated evidence collection is partial via existing coding/git/test services. No deployment engine, no monitoring dashboards. |
| Skill replay coverage | PARTIAL | Real replay supports 9 opt-in action handlers with traces and pause/stop. Pivots, full Office cross-app actions and complex UI sequences remain unsupported and fail closed. |
| System state readback | PARTIAL | Wi-Fi state and Bluetooth device presence are read back with timestamps. Volume/mute/brightness return `NOT_VERIFIED` instead of a guessed value. |
| IDE orchestration (open tabs, diagnostics, terminal state, branch, selected code) | PARTIAL | Unified read-only state endpoint exists. Diagnostics, open tabs and terminal task state require an IDE extension/API and are NOT_IMPLEMENTED, not guessed. |
| GitHub PR automation, issue investigation | PARTIAL | Connector exists; token/OAuth is `AUTHENTICATION_REQUIRED`. |
| Clipboard inference | FRAMEWORK + PARTIAL | `getClipboard()` exists; used only on explicit "this macro" voice request. No continuous retention, by design. |
| Autonomy levels 0-5 | PARTIAL | Desktop actions have per-action confirmation and privacy mode; a named, visible, reversible autonomy-level control is not built. |
| Signed installer | CONFIGURATION_REQUIRED | External EV certificate required. |

## 5. Next increments, in order

1. Signed installer (external EV certificate required; current 9.8.0 installers are unsigned).
2. Screenshot/Figma/reference-driven website generation (existing generator is natural-language only).
3. Autonomy levels 0-5 as a visible, reversible control surface.
4. Deployment, monitoring dashboards and maintenance mode (frameworks exist, engines do not).
5. Signed installer (external EV certificate required).

## 6. Standing rules

- Never fabricate demand, compliance, security status, deployment, test results, sources, customers, payments or capability status.
- High-risk actions require confirmation. `close`, `delete` and sheet/row deletion return `APPROVAL_REQUIRED` without `confirm: true`.
- Business data never reaches GitHub.
- The 3D companion, voice loop, memory, skills, MCP, adapters and all existing endpoints are preserved.
- No emojis anywhere.
