# MYRAA Kaggle Worker Setup (Phase 7)

Notebook: `myraa_kaggle_worker.ipynb` (7 cells).

1. Kaggle -> Create -> New Notebook. Settings -> Accelerator -> GPU T4 x2.
2. Cell 1 (markdown): read the rules. Never paste secrets.
3. Cell 2 (config): set MODEL_ID / QUANTIZATION / DTYPE. Defaults run a
   ~1.1B smoke model that fits one T4.
4. Run cells 2-5 (deps, GPU discovery, CUDA/FP16/multi-GPU/NCCL, capability
   report). Expected on T4x2: 2 GPUs, ~14.56 GB each, cc 7.5, NCCL present.
5. Copy the printed capability JSON into MYRAA: Compute Center shows workers
   after `POST /api/compute/workers/kaggle-t4x2/heartbeat {"caps": {...}}`.
   MYRAA accepts the notebook capability shape directly and derives
   `single_gpu_vram_gb` (max) and `aggregate_vram_gb` (sum) when absent.
6. In MYRAA, submit a KAGGLE job (Compute Center), export the job JSON
   (`GET /api/compute/jobs/:id/export`), paste it into JOB_JSON_INLINE or
   drop it at `/kaggle/input/myraa_job.json`, run cells 6-7.
7. Import `/kaggle/working/myraa_result.json` via
   `POST /api/compute/workers/kaggle-t4x2/results`. Both `jobId` and
   `job_id` keys are accepted; token metrics lift into job metrics.

Known notebook issues to fix on the Kaggle side (cell 10 is markdown but
contains the job-engine code, so it never executes; cell 11 then fails on
`utc_now`): change cell 10's type to Code, or move `utc_now` into an
executing cell. For `kaggle kernels push`, set metadata
`enable_gpu=true`, `machine_shape=NvidiaTeslaT4`, `is_private=true`.

Verified reference environment: PyTorch 2.11.0+cu128, CUDA 12.8,
2x Tesla T4 14.56 GB (29.12 aggregate), FP16 + simultaneous multi-GPU working.

Limits: sessions are finite; quota is limited and not visible to MYRAA;
model downloads cost time/disk; >14.56 GB single-GPU needs sharding support;
treat every session as disposable.
