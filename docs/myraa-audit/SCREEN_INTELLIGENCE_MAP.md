# Screen Intelligence + Universal Computer Agent — implementation map

Date: 2026-11-18 · Status: Phase 1 audit + Phase 2/3/4/6 first slice implemented. Nothing here replaces existing systems.

## 1. Existing implementations (audit, reuse — do not duplicate)

| Source | File | Real capability | Gap |
|---|---|---|---|
| Screen capture | `electron/main.cjs:870-925` (desktopCapturer via IPC), `desktopAutomation.cjs:695` (PowerShell CopyFromScreen), `screen_scroll_stitcher.cjs` (scroll+stitch) | 4 capture backends, consent gating, dedupe/cache | `takeScreenshot()` returns `ok:true,image:null` in headless sessions |
| OCR | `ocr_engine.cjs` (`recognize`, `status`) | local tesseract.js OCR | only used when caller supplies image bytes |
| UIA | `ui_automation_service.cjs` + `ui_automation_runner.ps1` | `listVisibleWindows()`, `getAppControlMap(target,max)`, `invokeControl`, `setControlValue` | PowerShell spawned per call; no unified normalized context |
| Screen context | `screen_context.cjs`, `ax_context.cjs` (Mac) | window/selection/control descriptions | platform split, not one API |
| Awareness routes | `live_awareness_routes.cjs`, `server.cjs` consent gates | L0-L5 honest levels, consent file, foreground probe | no single ScreenContext object |
| Vision | `/api/vision/analyze-frame`, vision model routing | screenshot analysis via cloud/local model | not wired into action verification |
| Browser | `browser_agent.cjs` | Playwright abstraction (navigate/click/type/screenshot) | **Playwright not installed** — agent cannot start |
| Desktop actions | `desktopAutomation.cjs` (~92 methods), `universal_app_control.cjs` | real Win32 + UIA + SendKeys | sensitive-field detection exists but not enforced |
| Approval | `safety_broker.cjs`, `approval_manager.cjs` | real broker/workspace cards + HTTP approval | not all privileged routes are gated yet |
| Action registry | `action_registry.cjs` (47 actions) | schemas/risk/approval metadata | no target resolver attached until now |
| Office | `office_doc_engine.cjs` (Word/Excel/PPT via Python) | create/read/edit/format/export | no before/after verification loop |

## 2. Implemented slice (this pass)

- `resources/app/dist/screen_intelligence.cjs` — **one normalized ScreenContext** over the existing sources:
  - consent gate (denies observation when `screen_awareness_consent.json` is not enabled — honest `NEEDS_PERMISSION`)
  - active window from real `uia.listVisibleWindows()` (labelled as foreground approximation)
  - UIA control map normalized from real `uia.getAppControlMap(title, 300)`
  - screenshot/OCR statuses derived from real service responses (no bytes → `UNAVAILABLE`, never a fake image)
  - confidence computed from real sources actually present (never 1.0 by default)
  - `resolveTarget()` pipeline: semantic UIA exact → partial → control type → explicit coordinate fallback → `NOT_FOUND`
- Mounted at `/api/screen-intelligence` (`/status`, `/context`, `/observe`, `/resolve-target`).
- `tests/test_screen_intelligence.cjs` — 14 checks (consent gate, real-source context, normalized controls, honest screenshot status, confidence, target resolution tiers, no network/3D access).
- No new capture engine, no duplicate OCR, no duplicate UIA runner, avatar/voice untouched.

## 3. Still missing (honest)

- Action → observe → verify → correct loop (spec phases 7–8) — target resolver exists but is not yet connected to execution.
- Application adapter registry (Word/Excel/PPT/VSCode/Browser adapters) — only generic UIA today.
- Word/Excel/PowerPoint deep quality analysis and before/after verification.
- Real browser agent (install Playwright), DOM/accessibility-tree extraction.
- Vision-model routing for screen analysis and region-based incremental OCR.
- Change detector for event-driven observation (currently on-demand only).
- Privacy control center enforcement (private windows/apps, never-send-to-cloud, redaction enforcement).
- Screen Awareness HUD and Activity Center UI fed by the new context.
- File ingestion pipeline for PDF/DOCX/XLSX/PPTX/media/zip at scale.
- Skill execution sandbox, MCP resources/prompts/HTTP, OAuth, durable task graph, workflow learning.
- v9.7.0 installer containing any of this (all work is source-only).

## 4. Priority order (from the spec)

1. Connect target resolver to existing action engine + verification (phases 7–8).
2. Application adapters starting with Word/Excel (phases 6, 9–11).
3. Browser runtime + DOM context (phase 12).
4. Change detector + vision routing + privacy enforcement (phases 23–26).
5. Everything else per the spec's 30-phase order; installer last.
