# MYRAA Model Routing (Phase 7)

Existing text/model routing (model_router, ai_gateway) is untouched.

Compute routing decides WHERE a job runs:

- AUTO (default): trivial (no model/gpuRequired) -> LOCAL CPU path if host
  online; GPU work -> KAGGLE only if enabled + fresh worker; else refusal
  with a machine-readable code, never silent failure.
- LOCAL: CPU-only host accepts trivial jobs; GPU jobs get EXECUTOR_PENDING
  (Phase 7b) unless a local GPU fits — detection is real via nvidia-smi.
- CLOUD: accepted only with configured keys; GPU executors pending (7b).
- KAGGLE: enabled + fresh heartbeat + placement fits -> outbox + QUEUED.
- MANUAL: stored as CREATED for explicit handling.

Placement preflight (before any dispatch):
estimate = paramsB * bytesPerParam * 1.2 + context reserve (explicit formula).
Fits one GPU -> single. Else needs verified sharding + aggregate fit ->
sharded. Else MODEL_VRAM_INSUFFICIENT and the job is recorded, not started.

Course Studio hook: lesson/job specs may carry compute_preference
(AUTO/LOCAL/CLOUD/KAGGLE); Course Studio never talks to Kaggle directly.
Conversational mapping ("use the GPU", "cancel the GPU job") is documented
for the orchestrator; intent edits land after this slice is verified.
