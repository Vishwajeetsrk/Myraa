# MYRAA Application Adapter Registry

Module: `resources/app/dist/application_adapters.cjs` · API: `/api/application-adapters` · Tests: `tests/test_application_adapters.cjs`.

Status: **partial** — detection and UIA observation are real; app-specific edit/execute bridges are not implemented.

## Truth contract

No adapter is marked active without a real detected window. Every result is derived from `ui_automation_service.listVisibleWindows()` and `getAppControlMap()` at call time. A static `"status": "ACTIVE"` label is never used as evidence.

## Adapters (16)

Word, Excel, PowerPoint, Outlook, OneNote, VS Code, Chrome, Edge, Firefox, File Explorer, Notepad, Windows Terminal, Task Manager, Adobe Photoshop, Figma, Canva.

Detection precedence:
1. Unique top-level window class (e.g. `XLMAIN` → Excel, `OpusApp` → Word, `PPTFrameClass` → PowerPoint), confidence 0.9.
2. Title pattern, confidence 0.75–0.85.

Chromium/Electron apps share `Chrome_WidgetWin_1`. For Chrome, Edge, VS Code, Figma and Canva, className alone is **not** accepted — a title match is required. This prevents misidentifying every Electron window as VS Code (a real bug found and fixed during testing).

## Methods

| Method | Status | Source |
|---|---|---|
| `detect` | AVAILABLE | live window list |
| `inspect` | AVAILABLE | real UIA control map (names, types, automationId, rect, enabled) |
| `read` | AVAILABLE | named controls from that map |
| `locate` | AVAILABLE | `screen_intelligence.resolveTarget` over a real captured UIA tree (consent-gated) |
| `verify` | AVAILABLE | real before/after control-map diff (added/removed/changed) |
| `edit` | NOT_IMPLEMENTED | needs an app-specific live-document bridge |
| `create` | PARTIAL | document *generation* delegates to the existing Office engine; not live-app creation |
| `execute` | NOT_IMPLEMENTED | needs an app command bridge |

## Routes

- `GET /api/application-adapters/status` — adapter count, real detected count, honest method map
- `GET /api/application-adapters/catalog` — all adapters with declared detection patterns and method availability
- `GET /api/application-adapters/detect?includeUnmatched=true` — real detected windows + unmatched windows (no guessing)
- `POST /api/application-adapters/inspect` — `{appId}` or `{windowTitle}`, optional `maxElements`
- `POST /api/application-adapters/read` — named UIA controls
- `POST /api/application-adapters/locate` — `{appId, query}` semantic UIA target
- `POST /api/application-adapters/verify` — `{before, after}` control maps → CHANGED/UNCHANGED

## Remaining gaps

- Live edit/create/execute bridges per application (the spec's full `detect/inspect/read/locate/edit/create/execute/verify` surface).
- Semantic screen tree grouping windows into application → ribbon/document → controls (current UIA map is flat).
- OCR/vision fallback when UIA metadata is unavailable.
