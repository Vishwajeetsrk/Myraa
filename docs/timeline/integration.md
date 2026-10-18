# Task Timeline (Phase 23)

Read-only chronological view that merges the Phase 22 event bus, Phase 21
safety broker bindings, Phase 18 workspace approval cards and active
routines into one timeline. It owns no store of its own - every item carries
its source, and the `sources` map reports which modules were reachable, so
the view stays honest when a module is missing.

## Module
`resources/app/dist/task_timeline.cjs`

- `build({ sinceMs, limit })` -> `{ ok, sources, windowStart, count, upcomingCount, items, upcoming }`
  - `items`: newest first, max 60, kinds: `event`, `error`, `approval`, `pending`
  - `upcoming`: next up to 5 future items (kind `scheduled`, from active routines)
- `summary(input)` -> counts `{ events, approvals, pending, errors, scheduled }` + `sample` text lines
- `today()` -> build since local midnight
- `render(build, maxLines)` -> `- <date time> [kind] text` lines; honest "no activity recorded for this window" when empty
- `createRouter()` -> GET `/api/timeline` (summary), `/items`, `/today`
- `registerAgiTools(engine)` -> `timeline_summary`, `timeline_today` (LOW risk, category `timeline`)

Item sources:
- `events` - event bus entries (severity `error` maps to kind `error`)
- `broker` - safety broker bindings (`waiting`/`approved` map to kind `pending`; `executed`/`denied`/`expired` to `approval`)
- `workspace` - open approval cards (kind `pending`)
- `routines` - active routines' `nextRunAt` (kind `scheduled`, only future)

## Voice
- "timeline" / "show me the timeline"
- "what happened today"
- "summarize my day" / "my day"
- "today's activity"

Orchestrator intent: `timeline_today` -> handler `_timelineToday` (emits `timeline.viewed`).

## HTTP
- GET `/api/timeline` - summary + counts + sources
- GET `/api/timeline/items?limit=30&sinceMs=0`
- GET `/api/timeline/today`

## Env
None. The view delegates to each source module's own env-configured store
(`MYRAA_EVENTS_DB`, `MYRAA_BROKER_DB`, `MYRAA_WORKSPACE_DB`).

## Events emitted
- `timeline.viewed` (`{ count, upcoming }`) when the voice command runs.

## Tests
- `tests/test_timeline.cjs` (runs standalone with `NODE_PATH` pointing at
  `resources/app/node_modules` when executed outside the repo layout)

## Rollback
Copy `*.bak_phase23_*` back; delete `task_timeline.cjs`, `tests/test_timeline.cjs`, `docs/timeline`.
