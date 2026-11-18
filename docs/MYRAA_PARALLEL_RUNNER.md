# MYRAA Parallel Runner

Module: `resources/app/dist/parallel_runner.cjs` · API: `/api/parallel` · Tests: `tests/test_parallel_runner.cjs` (17 checks).

Status: **implemented for registered real jobs**; not a general arbitrary-code worker pool.

## What it does

Adds a bounded job graph over existing capability modules so independent work can be submitted together:

- **Job types (real module functions):** `video.status`, `video.probe`, `video.analyze`, `skill.status`, `skill.validate`, `app.detect`, `app.status`, `browser.capabilities`, `gap.analyze`, `system.health`.
- **Dependencies:** a job starts only after every `dependsOn` id is `COMPLETED`. Missing or failed dependencies are handled explicitly (rejected at submit / `DEPENDENCY_FAILED`), never left stuck in the queue.
- **Priority:** higher priority runs first, then submission order.
- **Concurrency:** bounded (default 3, max 8).
- **Retry:** bounded (0–3) with real error capture.
- **Timeout:** real `Promise.race` timer (clamped 500 ms–120 s).
- **Cancellation:** queued/running jobs are marked `CANCELLED` and their result discarded. Honest note: underlying synchronous modules may finish, but the result is not published.
- **Progress/aggregation:** `status()` reports running/queue depth/by-status; `results()` aggregates completed real outputs.
- **Receipts:** append-only JSONL under `<MYRAA_DATA_DIR>/parallel-runs.jsonl` and `parallel.*` events on the real event bus.

## Honesty notes

- A job result is `ok` only when the underlying module returned a real success-shaped result.
- `system.health` and `app.detect` call synchronous OS/PowerShell code; the scheduler can start jobs concurrently, but those synchronous bodies may serialize on the Node event loop. The pool reports scheduler concurrency, not fabricated CPU parallelism.
- Unknown job types are rejected (`UNKNOWN_JOB_TYPE`); there is no arbitrary-code execution path.

## Routes

| Route | Purpose |
|---|---|
| `GET /api/parallel/status` | pool config, live counts, job types, guarantees |
| `GET /api/parallel/types` | registered job types |
| `POST /api/parallel/submit` | `{type, params, dependsOn, priority, timeoutMs, retries}` |
| `GET /api/parallel/jobs` | all jobs with status/timings |
| `GET /api/parallel/results` | aggregated completed results |
| `GET /api/parallel/job/:id` | one job + result |
| `POST /api/parallel/cancel/:id` | cancel (honest about sync bodies) |

## Remaining gaps

- General worker threads / child-process isolation for CPU-bound or untrusted jobs.
- Durable cross-restart resume (receipts are append-only but not replayed into a new pool).
- Approval gating for HIGH-risk job types (current registered types are all LOW).
- Cancellation of in-flight synchronous UIA/ffmpeg calls (cooperative flag only today).
