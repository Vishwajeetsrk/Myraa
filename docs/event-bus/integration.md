# Unified Event Bus (Phase 22)

One append-only operational log for tasks, tools, approvals, models, system
events. Foundation for the task timeline (Phase 23) and observability.

## Model

- `emit(type, payload, { source, severity })` - namespaced types
  (`system|task|tool|approval|broker|model|connector|evidence|investigation|
  routine|workspace|timeline|permission|mcp` + `.header`).
- In-memory ring (last 2000) + JSONL file; periodic compaction keeps the file
  near the ring size. `subscribe(fn)` for in-process consumers.
- Payloads are sanitized: strings sliced at 200, depth 3, max 10 array items,
  max 12 keys, serialized payload capped at 800 chars (`{truncated}` marker),
  keys matching key|token|secret|password|credential|apikey|authorization are
  `[redacted]`.
- `emit` never throws; if the write fails the event still returns with
  `stored:false` (honest reporting, no silent loss).

## Wired sources (this phase)

- `system.server_start` at boot (server mount).
- `task.recognized` / `task.finished` from the coding orchestrator loop.
- `events_tail` agi tool (LOW risk, category events).

## Voice commands

- "activity log" / "show events" / "what's happened lately" -> last 10 events
  with time, type and human summary.

## HTTP

- GET /api/events (status), /api/events/list?limit&type&since, /api/events/tail?n
- POST /api/events/emit { type, payload } (validated; source "api")

## Env

- `MYRAA_EVENTS_DB` - override log path (default
  `%APPDATA%\MYRAA\events\events.jsonl`).

## Attribution

Original design for MYRAA; no third-party code. Implements the event-bus step
from the master integration prompt (task/agent/tool/approval/model events).

## Files

- `resources/app/dist/event_bus.cjs`
- `tests/test_event_bus.cjs`
- patched `resources/app/dist/server.cjs` (boot mount + router),
  `resources/app/dist/coding_orchestrator.cjs` (intent, case, handlers,
  task emits)

## Rollback

Copy `coding_orchestrator.cjs.bak_phase22_*` and `server.cjs.bak_phase22_*`
back; delete `event_bus.cjs`, `tests/test_event_bus.cjs`, `docs/event-bus/`.
