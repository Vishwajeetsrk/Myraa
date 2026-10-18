# MYRAA Integration Map (Phase 0 — where Course Studio plugs in)

## New module placement

```
MYRAA (unchanged shell: avatar + chat/voice + desktop panels)
  └─ Course Studio = NEW panel/view + NEW router + optional plugin
       ├─ frontend: new view/panel beside avatar (avatar stays central)
       ├─ backend:  resources/app/dist/course_studio_routes.cjs (new Router)
       │             mounted in startServer() after server.cjs:5074
       └─ optional: resources/app/plugins/course-studio/ (tools[] for AI use)
```

## Touch points (all REUSE, no rewrites)

| Need | Existing seam | How to use |
|---|---|---|
| Curriculum/lesson/quiz text | `ai_gateway_service.call({stream,onChunk})`; `model_router.executeWithFallback('reasoning'/'document'/'fast')` | Structured JSON prompts; stream tokens to UI |
| Narration audio | Existing voice only: browser speechSynthesis (pitch 1.25), `/api/speak` System.Speech Female, Gemini Live WS audio | Narration = text segments replayed through these paths; store segment text + timing, not new audio files unless user approves |
| Source docs | `office_doc_engine.readDocument()`, upload routes, `web_fetch_service` (URL/GitHub), `memory_kb.ingest` for RAG | Course sources ingested via same pipeline; real PDF parser still MISSING (needs pdf-parse/pdfplumber) |
| Learner memory | `POST /api/memory/remember` (category taxonomy), `kb.retrieve` | Store learner prefs/weak concepts as categorized memories; course entities live in NEW tables, not the memories table |
| Progress UI | SSE template (`autoUpdateEngine.cjs:75-99`), per-job poll route pattern (`GET /api/research/status/:jobId`), toast | New `GET /api/course-studio/jobs/:id` + optional SSE stream |
| Screen context | ScreenVisionPipeline.capture(), `/api/vision/analyze-frame`, desktopPerception poll | Reuse behind NEW explicit consent toggle + route-level permission checks |
| Desktop demo actions | `SafetyPolicy.assess()` + ConfirmationStore + `confirmPendingAction` | All course-triggered desktop actions go through existing approval flow |
| Publishing/export | Remotion scaffold, file-write guard (`guardFileMutation`), approved roots | Export only inside approved roots with confirmation |

## What NOT to touch

- Avatar assets/state/animation, voice pipeline selection, chat flow, `/api/integrations` vocabulary, security middleware, vault, version reader.
- No second memory store, no second job queue, no second model gateway, no second screen-capture stack.

## Scrimba position

Treat as optional external integration (MCP `https://scrimba.com/explain/mcp`), registered via the canonical connector pattern when the user approves. Native MYRAA explainer is the source of truth; Scrimba export is one-way and never blocks native generation.
