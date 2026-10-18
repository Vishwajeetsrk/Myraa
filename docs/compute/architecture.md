# MYRAA Compute Architecture (Phase 7)

MYRAA is the control plane. Kaggle T4x2 is an optional ephemeral GPU worker.
Nothing in normal MYRAA operation depends on Kaggle.

```
MYRAA (avatar + chat + desktop, unchanged)
  └─ ComputeManager (compute_manager.cjs)
       ├─ LOCAL      detectLocal(): nvidia-smi or honest CPU-only
       ├─ CLOUD_API  cloudStatus(): gateway keys present or NOT_CONFIGURED
       └─ KAGGLE     file outbox/inbox; heartbeat freshness 30 min
```

Job flow: validate -> sanitize -> estimate -> placement preflight ->
persist (CREATED) -> dispatch (QUEUED + outbox JSON) -> worker runs notebook ->
result import (COMPLETED/FAILED + artifact). Progress stays UNKNOWN until the
worker reports. Quota stays UNKNOWN (no Kaggle quota API).

Routing: AUTO (default) | LOCAL | CLOUD | KAGGLE | MANUAL. Trivial jobs stay
local; GPU jobs go to Kaggle only when KAGGLE_COMPUTE_ENABLED=1 AND a fresh
heartbeat exists; otherwise honest refusal codes (PROVIDER_DISABLED,
WORKER_OFFLINE, MODEL_VRAM_INSUFFICIENT, EXECUTOR_PENDING).

Memory rule: single_gpu_vram_gb and aggregate_vram_gb are separate facts.
Observed reference worker: 2x14.56GB, 29.12 aggregate. A model over one GPU
needs verified sharding or it is refused before starting.

Persistence: cp_jobs / cp_workers / cp_events in SQLite (bridge), artifacts as
files under %APPDATA%/MYRAA/compute/artifacts/<jobId>/. Supabase DDL later.
