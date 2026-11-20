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
| Cross-application Excel to Word to PowerPoint to Outlook to browser workflow | NOT_IMPLEMENTED | No single orchestration endpoint exists yet. |
| Website design from screenshots/Figma/references | NOT_IMPLEMENTED | Existing site generator handles natural-language builds; screenshot/Figma ingestion not built. |
| Live legal/compliance research with current official sources | FRAMEWORK + NOT_IMPLEMENTED | The structure exists. No live government-source fetch, no date-stamped citation verification. India DPDP Rules 2025 commencement, CERT-In directions and GST place-of-supply must be checked on official sources per transaction; nothing is asserted here. |
| Repository health, code review, A/B, deployment, observability, maintenance, scale modes | FRAMEWORK + PARTIAL | Structured checklists exist; automated evidence collection is partial via existing coding/git/test services. No deployment engine, no monitoring dashboards. |
| Skill replay execution | NOT_IMPLEMENTED | The compiler creates/edits/dry-runs/publishes instruction-only skills. "Run the workflow" honestly returns NOT_IMPLEMENTED; no automation is claimed to have executed. |
| System state readback | PARTIAL | The matrix reports status and opens settings pages; it does not read back Wi-Fi, Bluetooth, brightness or mute state. "Opened settings" is never reported as "setting changed". |
| IDE orchestration (open tabs, diagnostics, terminal state, branch, selected code) | PARTIAL | UIA focus/selection and git services exist; no unified IDE state endpoint. |
| GitHub PR automation, issue investigation | PARTIAL | Connector exists; token/OAuth is `AUTHENTICATION_REQUIRED`. |
| Clipboard inference | FRAMEWORK + PARTIAL | `getClipboard()` exists; used only on explicit "this macro" voice request. No continuous retention, by design. |
| Autonomy levels 0-5 | PARTIAL | Desktop actions have per-action confirmation and privacy mode; a named, visible, reversible autonomy-level control is not built. |
| Signed installer | CONFIGURATION_REQUIRED | External EV certificate required. |

## 5. Next increments, in order

1. Excel depth: named ranges, sort/filter, tables, conditional formatting, data validation, readback verification.
2. Skill replay execution with step-by-step mode, pause/resume/stop and visible Action Playback view (never fake a run).
3. IDE state endpoint composing existing git, terminal, UIA focus and diagnostics sources.
4. Client discovery engine with strict "Website: Not found" rule, source URLs and confidence labels.
5. Cross-application workflow orchestrator built on existing engines, not a new runner.
6. Live legal-awareness research adapter with official-source allowlist and date-stamped citations.
7. Performance telemetry: command latency, screen-analysis latency, tool startup and failure rate.

## 6. Standing rules

- Never fabricate demand, compliance, security status, deployment, test results, sources, customers, payments or capability status.
- High-risk actions require confirmation. `close`, `delete` and sheet/row deletion return `APPROVAL_REQUIRED` without `confirm: true`.
- Business data never reaches GitHub.
- The 3D companion, voice loop, memory, skills, MCP, adapters and all existing endpoints are preserved.
- No emojis anywhere.
