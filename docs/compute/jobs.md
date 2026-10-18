# MYRAA GPU Jobs (Phase 7)

States: CREATED QUEUED VALIDATING PREPARING LOADING_MODEL RUNNING FINALIZING
COMPLETED FAILED CANCELLED EXPIRED RETRYING. Only worker-reported transitions
occur; MYRAA never invents RUNNING. Progress is UNKNOWN until reported.

Job record: id, jobType, route, provider, worker_id, status, progress,
spec (sanitized), estimate {estimatedGB, uncertain, placement}, error
{code, message, retryable, action}, artifacts[], metrics{}, timestamps.

Failure codes: GPU_OOM MODEL_LOAD_FAILED CUDA_ERROR NCCL_ERROR WORKER_OFFLINE
QUOTA_EXHAUSTED NETWORK_ERROR INVALID_JOB MODEL_NOT_FOUND
MODEL_VRAM_INSUFFICIENT ARTIFACT_ERROR TIMEOUT PRIVACY_REJECTED
PROVIDER_DISABLED UNKNOWN. Non-retryable: insufficient VRAM, model not found,
invalid job, privacy rejection.

Events (cp_events, persistent): worker.online/offline, job.created/queued/
started/model_loading/running/progress/completed/failed/cancelled/expired/
retrying, gpu.oom, nccl.failure, quota.low/exhausted. Surfaced per job and
globally (cap 200).

API: GET providers/workers/capabilities/quota, POST estimate, POST jobs,
GET jobs, GET jobs/:id (+events), POST jobs/:id/cancel, GET jobs/:id/export,
GET jobs/:id/artifacts, POST workers/:id/heartbeat, POST workers/:id/results.
