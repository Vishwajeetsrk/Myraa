# MYRAA Compute Providers (Phase 7)

## LOCAL
Detection: `nvidia-smi --query-gpu=...` with 8s timeout; absent GPU means
`gpu_count: 0, status: online` (host up, CPU only). Never claims a GPU that
was not detected. Local GPU executors land in Phase 7b; the slice reports
capabilities + estimates only.

## CLOUD_API
Represents the existing AI gateway. Status online iff a known provider key
exists in env (Gemini/Groq/OpenRouter/Anthropic/OpenAI). No new credentials.

## KAGGLE (ephemeral, optional)
- Enabled only via `KAGGLE_COMPUTE_ENABLED=1` (default off).
- Online = heartbeat imported within 30 minutes via
  `POST /api/compute/workers/:id/heartbeat` (capability JSON from the notebook).
- Transport: MYRAA writes `compute/outbox/<jobId>.json`; the user runs the
  `myraa_kaggle_worker.ipynb` notebook against it; the result JSON comes back
  via `POST /api/compute/workers/:id/results` or the Compute Center.
- No tunnel, no ngrok, no invented Kaggle API, no quota bypass.
- Quota fields are UNKNOWN by design.

## Future providers
Implement the manager's store interface + a detector; no application job logic
changes. Add the provider id to compute_schema PROVIDERS and a status source.
