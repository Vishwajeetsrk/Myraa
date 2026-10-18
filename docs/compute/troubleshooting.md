# MYRAA Compute Troubleshooting (Phase 7)

- "PROVIDER_DISABLED" on KAGGLE submit: set KAGGLE_COMPUTE_ENABLED=1 and
  restart the backend. Default is off by design.
- "WORKER_OFFLINE": no heartbeat within 30 min. Re-run notebook cells 2-5
  and re-import the capability JSON.
- "MODEL_VRAM_INSUFFICIENT": estimate exceeds one GPU without verified
  sharding. Use a smaller/quantized model or enable sharding support.
- Job stuck QUEUED: the worker never picked it up (ephemeral by design).
  Cancel and resubmit after starting the notebook.
- "EXECUTOR_PENDING": local/cloud GPU execution is Phase 7b; the job is
  stored, nothing was started or billed.
- Quota UNKNOWN: expected. Kaggle exposes no quota API; check the Kaggle
  account page directly and conserve usage (batch jobs, prefer local).
- Result import 404: wrong jobId or job row missing; export IDs match
  outbox filenames exactly.
- Rollback: restore *.bak_phase7_* files, delete compute_* dist files +
  test, drop cp_* tables (bridge has no down-migration; tables are additive
  and inert without the router).
