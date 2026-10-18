'use strict';
/**
 * MYRAA Compute — manager (Phase 7 vertical slice).
 * Provider-neutral orchestration. No tunnels, no invented APIs.
 * Kaggle link = file outbox/inbox protocol (user moves job JSON to the
 * notebook, brings result JSON back). Jobs never claim states the worker
 * did not report. Quota is UNKNOWN unless a worker reports otherwise.
 * KAGGLE_COMPUTE_ENABLED defaults to false; AUTO never routes to Kaggle
 * unless enabled AND a worker heartbeat is fresh.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const schema = require('./compute_schema.cjs');

const WORKER_FRESH_MS = 30 * 60 * 1000;
const MODEL_DEFAULTS = {
  // paramsB + defaults; memory estimated by formula, never hard-coded per model.
  'llama-3-8b': { paramsB: 8 }, 'mistral-7b': { paramsB: 7.3 }, 'qwen2-7b': { paramsB: 7.6 },
  'phi-3-mini': { paramsB: 3.8 }, 'gemma-2-9b': { paramsB: 9.2 }, 'llama-3-70b': { paramsB: 70 },
};

function dataRoot() {
  const appData = process.env.APPDATA
    || (process.platform === 'darwin'
      ? path.join(process.env.HOME || '', 'Library/Application Support')
      : path.join(process.env.HOME || '', '.config'));
  return process.env.MYRAA_DATA_DIR || path.join(appData, 'MYRAA');
}
function computeDirs() {
  const root = path.join(dataRoot(), 'compute');
  const dirs = { root, outbox: path.join(root, 'outbox'), inbox: path.join(root, 'inbox'), artifacts: path.join(root, 'artifacts'), kernels: path.join(root, 'kernels') };
  try {
    for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true });
  } catch (e) {}
  return dirs;
}

function workerTemplatePath() {
  return path.join(__dirname, 'kaggle_worker_template.ipynb');
}

// API transport attempt for a QUEUED kaggle job. Returns {transport:'api'|'file', detail}.
// Never throws: failures keep the file outbox as the actionable artifact.
function tryApiDispatch(job, worker, jobPayload) {
  try {
    const cli = require('./compute_kaggle_cli.cjs');
    const avail = cli.availability();
    const kernelRef = worker && (worker.kernel || (worker.caps && worker.caps.kernel));
    if (!avail.ok || !kernelRef) {
      return { transport: 'file', detail: !avail.ok ? ('CLI unavailable: ' + avail.error) : 'worker has no kernel ref; file outbox only' };
    }
    let template;
    try {
      template = JSON.parse(fs.readFileSync(workerTemplatePath(), 'utf8'));
    } catch (e) {
      return { transport: 'file', detail: 'worker template notebook missing in dist' };
    }
    const rendered = cli.renderJobNotebook(template, jobPayload);
    if (!rendered.ok) return { transport: 'file', detail: 'template render failed: ' + rendered.error };
    const kdir = path.join(computeDirs().kernels, job.id);
    const acc = (worker.caps && worker.caps.accelerator) || cli.DEFAULT_ACCELERATOR;
    const authored = cli.authorKernelDir(kdir, {
      slug: kernelRef, title: 'myraa-' + job.id,
      notebookJson: rendered.notebookJson, accelerator: acc, private: true, enableInternet: false,
    });
    if (!authored.ok) return { transport: 'file', detail: 'kernel staging failed: ' + authored.error };
    const push = cli.pushRun(avail.bin, require('./compute_kaggle_cli.cjs').resolveToken().token, kdir, acc, 0);
    if (!push.ok) return { transport: 'file', detail: 'kaggle push failed: ' + push.error };
    return { transport: 'api', detail: 'pushed to ' + kernelRef + ' (' + acc + '); poll via sync', kernelRef, kernelDir: kdir };
  } catch (e) {
    return { transport: 'file', detail: 'API transport error: ' + String((e && e.message) || e).slice(0, 200) };
  }
}

function kaggleEnabled(env) {
  const v = String((env || process.env).KAGGLE_COMPUTE_ENABLED || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

// Real local detection: nvidia-smi or honest CPU-only.
function detectLocal() {
  const caps = {
    provider: 'local', worker_id: 'local', status: 'UNKNOWN',
    gpu_count: 0, gpus: [], aggregate_vram_gb: 0, single_gpu_vram_gb: 0,
    cuda_version: 'UNKNOWN', pytorch_version: 'UNKNOWN', fp16: 'UNKNOWN',
    bf16: 'UNKNOWN', nccl: false, multi_gpu: false, last_seen: schema.nowIso(),
  };
  try {
    const out = execFileSync('nvidia-smi',
      ['--query-gpu=index,name,memory.total,driver_version', '--format=csv,noheader,nounits'],
      { timeout: 8000, windowsHide: true, encoding: 'utf8' });
    const lines = String(out || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const gpus = [];
    for (const ln of lines) {
      const parts = ln.split(',').map((s) => s.trim());
      if (parts.length < 3) continue;
      const vramMB = Number(parts[2]);
      gpus.push({ index: Number(parts[0]), model: parts[1], vram_gb: isFinite(vramMB) ? Math.round((vramMB / 1024) * 100) / 100 : 0 });
    }
    if (gpus.length) {
      caps.status = 'online';
      caps.gpu_count = gpus.length;
      caps.gpus = gpus;
      caps.single_gpu_vram_gb = Math.max(...gpus.map((g) => g.vram_gb));
      caps.aggregate_vram_gb = Math.round(gpus.reduce((a, g) => a + g.vram_gb, 0) * 100) / 100;
      caps.multi_gpu = gpus.length > 1;
    } else {
      caps.status = 'online';
    }
  } catch (e) {
    caps.status = 'online'; // host is up; just no NVIDIA GPU visible
  }
  return caps;
}

function cloudStatus(env) {
  const e = env || process.env;
  const keys = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'];
  const hasKey = keys.some((k) => e[k] && String(e[k]).trim().length > 8);
  return {
    provider: 'cloud_api', worker_id: 'cloud_api',
    status: hasKey ? 'online' : 'NOT_CONFIGURED',
    gpu_count: 0, gpus: [], aggregate_vram_gb: 0, single_gpu_vram_gb: 0,
    detail: hasKey ? 'AI gateway keys present.' : 'No provider keys in env.',
    last_seen: schema.nowIso(),
  };
}

function createComputeManager(store) {
  // store: {saveJob, loadJob, listJobs, saveWorker, loadWorker, listWorkers, addEvent, listEvents}
  const dirs = computeDirs();

  function getProviders() {
    return [Object.assign({ type: 'LOCAL' }, detectLocal()), Object.assign({ type: 'CLOUD_API' }, cloudStatus())];
  }

  async function getWorkers() {
    return store.listWorkers();
  }

  function workerOnline(w) {
    if (!w || w.status === 'offline') return false;
    const age = Date.now() - new Date(w.last_seen || 0).getTime();
    return age >= 0 && age < WORKER_FRESH_MS;
  }

  function getQuota() {
    return {
      provider: 'kaggle', gpu_hours_used: 'UNKNOWN', gpu_hours_remaining: 'UNKNOWN',
      quota_reset: 'UNKNOWN', status: 'UNKNOWN',
      last_checked: schema.nowIso(),
      note: 'Kaggle exposes no quota API to MYRAA; values are UNKNOWN by design, never guessed.',
    };
  }

  function resolveModel(name, quant, ctx) {
    const key = String(name || '').toLowerCase();
    const entry = MODEL_DEFAULTS[key] || {};
    const paramsB = Number(entry.paramsB) || 0;
    return schema.estimateModelGB(paramsB, quant || 'fp16', ctx || 4096);
  }

  function estimate(spec) {
    const model = (spec && spec.model) || {};
    const est = resolveModel(model.id, model.quantization, model.contextTokens);
    return {
      ok: est.ok, estimatedGB: est.estimatedGB || null, uncertain: !est.ok,
      formula: est.formula || null, reason: est.reason || null,
      single_gpu_note: 'A model needing more than one GPU requires verified sharding.',
    };
  }

  function decideRoute(spec, providers, workers) {
    const want = String((spec && spec.route) || 'AUTO').toUpperCase();
    const gpuRequired = !!(spec && (spec.gpuRequired || spec.model));
    const kaggleWorkers = (workers || []).filter((w) => w.provider === 'kaggle' && workerOnline(w));
    if (want === 'KAGGLE' || (want === 'AUTO' && gpuRequired)) {
      if (!kaggleEnabled()) return { route: 'KAGGLE', accepted: false, code: 'PROVIDER_DISABLED', detail: 'KAGGLE_COMPUTE_ENABLED is not set. Enable it to use Kaggle workers.' };
      if (!kaggleWorkers.length) return { route: 'KAGGLE', accepted: false, code: 'WORKER_OFFLINE', detail: 'No fresh Kaggle worker heartbeat (30 min window). Import one via POST /api/compute/workers/:id/heartbeat.' };
      const w = kaggleWorkers.sort((a, b) => String(b.last_seen).localeCompare(String(a.last_seen)))[0];
      return { route: 'KAGGLE', accepted: true, worker: w };
    }
    if (want === 'LOCAL') {
      const local = (providers || []).find((p) => p.provider === 'local');
      if (gpuRequired && (!local || !local.gpu_count)) {
        return { route: 'LOCAL', accepted: false, code: 'MODEL_VRAM_INSUFFICIENT', detail: 'Local host has no NVIDIA GPU; local GPU executor lands in Phase 7b.' };
      }
      return { route: 'LOCAL', accepted: !gpuRequired, code: gpuRequired ? 'EXECUTOR_PENDING' : undefined, detail: gpuRequired ? 'Local GPU executor lands in Phase 7b; job stored, not started.' : 'Local CPU accepted (slice executes trivial jobs only).' };
    }
    if (want === 'CLOUD') {
      const cloud = (providers || []).find((p) => p.provider === 'cloud_api');
      if (!cloud || cloud.status !== 'online') return { route: 'CLOUD', accepted: false, code: 'PROVIDER_DISABLED', detail: 'No cloud provider keys configured.' };
      if (gpuRequired) return { route: 'CLOUD', accepted: false, code: 'EXECUTOR_PENDING', detail: 'Cloud GPU executor lands in Phase 7b; job stored, not started.' };
      return { route: 'CLOUD', accepted: true, detail: 'Cloud API accepted.' };
    }
    // AUTO without GPU needs: prefer local CPU, then cloud.
    const local = (providers || []).find((p) => p.provider === 'local');
    if (local && local.status === 'online') return { route: 'LOCAL', accepted: true, detail: 'AUTO: local CPU sufficient.' };
    return { route: 'CLOUD', accepted: false, code: 'EXECUTOR_PENDING', detail: 'AUTO: no trivial-local path; cloud executor pending.' };
  }

  async function submitJob(spec, env) {
    const v = schema.validateJobSpec(spec || {});
    if (!v.ok) return { ok: false, error: v.errors.join(' | '), code: 'VALIDATION' };
    const priv = String((spec && spec.privacy) || '').toLowerCase();
    const allowRemote = spec && spec.allowRemote === true;
    const wantRoute = String((spec && spec.route) || 'AUTO').toUpperCase();
    const clean0 = schema.sanitizeSecrets(spec.input === undefined ? {} : spec.input);
    const est0 = estimate(spec);
    if ((priv === 'high' || priv === 'never-remote') && !allowRemote) {
      if (wantRoute === 'KAGGLE') {
        const job = await persistNew(spec, clean0, est0, { route: 'KAGGLE' }, { place: 'single', detail: 'privacy hold' }, 'CREATED');
        job.status = 'FAILED';
        job.error = { code: 'PRIVACY_REJECTED', message: 'Remote compute not allowed for this job (privacy=high). Set allowRemote:true to override.', retryable: false, action: 'Run LOCAL or explicitly allow remote.' };
        job.updatedAt = schema.nowIso();
        await store.saveJob(job);
        return { ok: false, error: job.error.message, code: 'PRIVACY_REJECTED', jobId: job.id };
      }
      if (wantRoute === 'AUTO') spec = Object.assign({}, spec, { route: 'LOCAL' });
    }
    const clean = schema.sanitizeSecrets(spec.input === undefined ? {} : spec.input);
    const est = estimate(spec);
    const providers = getProviders();
    const workers = await store.listWorkers();
    const decision = decideRoute(spec, providers, workers);
    // Placement check only when a provider accepted; otherwise the decision
    // reason (disabled/offline/pending) is the honest answer, not VRAM math.
    let placement = { place: 'single', detail: 'no model — trivial job' };
    if (decision.accepted && spec.model && est.ok) {
      const caps = decision.worker && decision.worker.caps
        ? decision.worker.caps
        : { single_gpu_vram_gb: 0, aggregate_vram_gb: 0, multi_gpu: false };
      placement = schema.placeModel(est.estimatedGB, caps, { supportsSharding: !!(spec.model && spec.model.supportsSharding) });
      if (placement.place === 'refused') {
        const job = await persistNew(spec, clean, est, decision, placement, 'CREATED');
        return { ok: false, error: placement.detail, code: placement.code, jobId: job.id };
      }
    }
    const job = await persistNew(spec, clean, est, decision, placement, decision.accepted ? 'QUEUED' : 'CREATED');
    if (decision.accepted && (decision.route === 'LOCAL' || decision.route === 'CLOUD')) {
      void runLocalCloud(job.id).catch(() => {});
    }
    if (decision.route === 'KAGGLE' && decision.accepted) {
      const outPath = path.join(dirs.outbox, job.id + '.json');
      const payload = { job_id: job.id, job_type: job.jobType, priority: job.priority || 'normal', model: spec.model || null, quantization: (spec.model && spec.model.quantization) || 'fp16', requested_gpu_count: (spec.model && spec.model.gpuCount) || 1, max_vram_gb: est.estimatedGB || null, input: spec.input === undefined ? null : JSON.parse(clean.text), output_format: 'json', placement };
      try {
        fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
      } catch (e) {
        job.status = 'FAILED';
        job.error = { code: 'ARTIFACT_ERROR', message: 'outbox write failed: ' + String(e.message || e), retryable: true, action: 'Retry submit; check disk/permissions.' };
        await store.saveJob(job);
        return { ok: false, error: job.error.message, code: job.error.code, jobId: job.id };
      }
      const worker = decision.worker || null;
      const apiTry = tryApiDispatch(job, worker, payload);
      job.transport = apiTry.transport;
      job.kernelRef = apiTry.kernelRef || null;
      job.kernelDir = apiTry.kernelDir || null;
      await store.saveJob(job);
      await store.addEvent({ job_id: job.id, type: 'compute.job.queued', detail: 'outbox: ' + outPath + ' | transport: ' + apiTry.transport + ' - ' + apiTry.detail });
      return { ok: true, jobId: job.id, route: decision.route, code: undefined, detail: 'QUEUED via ' + apiTry.transport + ': ' + apiTry.detail, estimate: est, placement, transport: apiTry.transport };
    } else {
      await store.addEvent({ job_id: job.id, type: 'compute.job.created', detail: decision.detail || decision.code || '' });
    }
    return { ok: decision.accepted, jobId: job.id, route: decision.route, code: decision.code, detail: decision.detail, estimate: est, placement };
  }

  async function persistNew(spec, clean, est, decision, placement, status) {
    const now = schema.nowIso();
    const job = {
      id: schema.makeId('gpu'), jobType: spec.jobType, route: decision.route,
      provider: decision.route === 'KAGGLE' ? 'kaggle' : decision.route.toLowerCase(),
      worker_id: (decision.worker && decision.worker.id) || null,
      status, progress: 'UNKNOWN', transport: 'file', kernelRef: '',
      spec: { input: spec.input === undefined ? null : JSON.parse(clean.text), model: spec.model || null, priority: spec.priority || 'normal', redactions: clean.redactions },
      estimate: { estimatedGB: est.estimatedGB || null, uncertain: !!est.uncertain, placement },
      error: decision.accepted ? null : { code: decision.code || 'UNKNOWN', message: decision.detail || '', retryable: true, action: 'See detail; adjust route or wait for executor.' },
      artifacts: [], metrics: {}, createdAt: now, updatedAt: now,
    };
    await store.saveJob(job);
    return job;
  }

  async function cancelJob(id) {
    const job = await store.loadJob(id);
    if (!job) return null;
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) return job;
    job.status = 'CANCELLED';
    job.error = { code: 'CANCELLED', message: 'Cancelled by user.', retryable: false, action: 'None.' };
    job.updatedAt = schema.nowIso();
    await store.saveJob(job);
    await store.addEvent({ job_id: id, type: 'compute.job.cancelled', detail: 'user cancel' });
    return job;
  }

  // Normalize worker capability shapes. Accepts the MYRAA worker notebook
  // capability report directly (pytorch/cuda keys, gpus[{name,vram_gb}]).
  // Derives single_gpu_vram_gb (max) and aggregate (sum) when absent.
  function normalizeCaps(raw) {
    const c = (raw && typeof raw === 'object') ? JSON.parse(JSON.stringify(raw)) : {};
    if (!Array.isArray(c.gpus)) c.gpus = [];
    c.gpus = c.gpus.map((g, i) => ({
      index: Number(g.index !== undefined ? g.index : i),
      model: String(g.model || g.name || 'UNKNOWN'),
      vram_gb: Number(g.vram_gb) || 0,
    })).filter((g) => g.vram_gb >= 0);
    if (!c.gpu_count && c.gpus.length) c.gpu_count = c.gpus.length;
    const known = c.gpus.filter((g) => g.vram_gb > 0).map((g) => g.vram_gb);
    if ((!c.single_gpu_vram_gb || !(c.single_gpu_vram_gb > 0)) && known.length) {
      c.single_gpu_vram_gb = Math.max(...known);
    }
    if ((!c.aggregate_vram_gb || !(c.aggregate_vram_gb > 0)) && known.length) {
      c.aggregate_vram_gb = Math.round(known.reduce((a, b) => a + b, 0) * 100) / 100;
    }
    if (c.cuda && !c.cuda_version) c.cuda_version = String(c.cuda);
    if (c.pytorch && !c.pytorch_version) c.pytorch_version = String(c.pytorch);
    if (c.multi_gpu === undefined) c.multi_gpu = (Number(c.gpu_count) || 0) > 1;
    return c;
  }

  async function heartbeat(workerId, caps) {
    const now = schema.nowIso();
    const normalized = normalizeCaps(caps || {});
    const clean = schema.sanitizeSecrets(normalized);
    let worker = await store.loadWorker(workerId).catch(() => null);
    worker = {
      id: workerId, provider: 'kaggle', status: 'online',
      caps: JSON.parse(clean.text), redactions: clean.redactions,
      last_seen: now, updatedAt: now,
    };
    await store.saveWorker(worker);
    await store.addEvent({ job_id: '', type: 'compute.worker.online', detail: workerId });
    return worker;
  }

  async function importResult(workerId, payload) {
    const p = payload || {};
    // Tolerate the worker notebook job shape: job_id, error{type,message}.
    const incomingId = String(p.jobId || p.job_id || '');
    const job = await store.loadJob(incomingId);
    if (!job) return { ok: false, error: 'job not found', code: 'INVALID_JOB' };
    const clean = schema.sanitizeSecrets(p.result === undefined ? {} : p.result);
    const upStatus = String(p.status || '').toUpperCase();
    // Worker notebook terminal states: FAILED, CANCELLED, blocked, load_failed, error.
    const failed = upStatus === 'FAILED' || upStatus === 'BLOCKED' || upStatus === 'LOAD_FAILED' || upStatus === 'ERROR';
    const cancelled = upStatus === 'CANCELLED';
    job.status = cancelled ? 'CANCELLED' : (failed ? 'FAILED' : 'COMPLETED');
    job.progress = failed ? 'UNKNOWN' : 1;
    const artDir = path.join(dirs.artifacts, job.id);
    try { fs.mkdirSync(artDir, { recursive: true }); } catch (e) {}
    const resultPath = path.join(artDir, 'result.json');
    try { fs.writeFileSync(resultPath, clean.text, 'utf8'); } catch (e) {
      return { ok: false, error: 'artifact write failed', code: 'ARTIFACT_ERROR' };
    }
    job.artifacts = [{ name: 'result.json', path: resultPath, bytes: Buffer.byteLength(clean.text, 'utf8') }];
    let metrics = (p.metrics && typeof p.metrics === 'object') ? p.metrics : {};
    try {
      const rj = JSON.parse(clean.text);
      if (rj && typeof rj === 'object') {
        for (const k of ['input_tokens', 'output_tokens', 'runtime_seconds', 'tokens_per_second']) {
          if (metrics[k] === undefined && rj[k] !== undefined) metrics[k] = rj[k];
        }
      }
    } catch (e) {}
    job.metrics = metrics;
    if (failed || cancelled) {
      const errObj = (p.error && typeof p.error === 'object') ? p.error : {};
      const errText = String(errObj.message || errObj.reason || p.error || p.reason || (cancelled ? 'cancelled' : 'worker reported failure')).slice(0, 500);
      const code = cancelled ? 'CANCELLED' : (schema.FAILURE_CODES.includes(p.errorCode) ? p.errorCode : (upStatus === 'LOAD_FAILED' ? 'MODEL_LOAD_FAILED' : 'UNKNOWN'));
      job.error = { code, message: errText, retryable: !['MODEL_VRAM_INSUFFICIENT', 'MODEL_NOT_FOUND', 'INVALID_JOB', 'PRIVACY_REJECTED'].includes(code), action: 'See message; fix and resubmit if retryable.' };
    } else {
      job.error = null;
    }
    job.updatedAt = schema.nowIso();
    await store.saveJob(job);
    await store.addEvent({ job_id: job.id, type: failed ? 'compute.job.failed' : 'compute.job.completed', detail: 'via ' + workerId + (clean.redactions ? ' (' + clean.redactions + ' redactions)' : '') });
    return { ok: true, jobId: job.id, status: job.status };
  }

  // Manual poll trigger for API-transport kaggle jobs (no daemon invented).
  // QUEUED/RUNNING + kernelRef -> status -> fetch output on COMPLETED.
  async function syncKaggleJob(id) {
    const job = await store.loadJob(String(id));
    if (!job) return { ok: false, error: 'job not found', code: 'INVALID_JOB' };
    if (job.transport !== 'api' || !job.kernelRef) {
      return { ok: false, error: 'job has no Kaggle kernel ref (file transport) — import results manually', code: 'INVALID_JOB', jobId: job.id, status: job.status };
    }
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
      return { ok: true, jobId: job.id, status: job.status, detail: 'terminal; nothing to sync' };
    }
    let cli;
    try {
      cli = require('./compute_kaggle_cli.cjs');
    } catch (e) {
      return { ok: false, error: 'CLI module missing', code: 'NOT_CONFIGURED', jobId: job.id };
    }
    const avail = cli.availability();
    if (!avail.ok) return { ok: false, error: avail.error, code: avail.code || 'NOT_CONFIGURED', jobId: job.id };
    const st = cli.kernelStatus(avail.bin, cli.resolveToken().token, job.kernelRef);
    if (!st.ok) {
      await store.addEvent({ job_id: job.id, type: 'compute.job.retrying', detail: 'status poll failed: ' + st.error });
      return { ok: false, error: st.error, code: 'NETWORK_ERROR', jobId: job.id };
    }
    if (st.mapped.state === 'RUNNING') {
      if (job.status !== 'RUNNING') {
        job.status = 'RUNNING';
        job.updatedAt = schema.nowIso();
        await store.saveJob(job);
        await store.addEvent({ job_id: job.id, type: 'compute.job.running', detail: st.mapped.detail });
      }
      return { ok: true, jobId: job.id, status: 'RUNNING', detail: st.mapped.detail };
    }
    if (st.mapped.state === 'COMPLETED') {
      const dlDir = path.join(dirs.artifacts, job.id, 'kaggle_out');
      const dl = cli.kernelOutput(avail.bin, cli.resolveToken().token, job.kernelRef, dlDir, '.*\\.json$');
      if (!dl.ok) return { ok: false, error: dl.error, code: 'NETWORK_ERROR', jobId: job.id };
      const resultFile = dl.files.map((f) => path.join(dlDir, f.name)).find((p) => /result/i.test(p)) || (dl.files[0] ? path.join(dlDir, dl.files[0].name) : null);
      if (!resultFile) return { ok: false, error: 'kernel completed but no JSON output found', code: 'ARTIFACT_ERROR', jobId: job.id };
      let payload;
      try {
        payload = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
      } catch (e) {
        return { ok: false, error: 'result JSON unreadable', code: 'ARTIFACT_ERROR', jobId: job.id };
      }
      return importResult(job.worker_id || 'kaggle-cli', Object.assign({}, payload, { jobId: job.id, status: 'COMPLETED' }));
    }
    // FAILED / CANCELLED on Kaggle side.
    const logs = cli.kernelLogs(avail.bin, cli.resolveToken().token, job.kernelRef);
    return importResult(job.worker_id || 'kaggle-cli', {
      jobId: job.id, status: job.status === 'CANCELLED' || st.mapped.state === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
      error: (logs.ok ? logs.logs : st.mapped.detail).slice(0, 500),
      errorCode: st.mapped.state === 'CANCELLED' ? 'CANCELLED' : 'UNKNOWN',
    });
  }

  // Fire-and-forget executor for accepted LOCAL/CLOUD jobs (Phase 7c).
  // QUEUED -> RUNNING -> COMPLETED/FAILED, all transitions persisted + logged.
  async function runLocalCloud(id) {
    const job = await store.loadJob(String(id));
    if (!job || job.status !== 'QUEUED') return;
    let exec;
    try {
      exec = require('./compute_executors.cjs');
    } catch (e) {
      job.status = 'FAILED';
      job.error = { code: 'NOT_CONFIGURED', message: 'executor module missing', retryable: false, action: 'Re-apply Phase 7.' };
      job.updatedAt = schema.nowIso();
      await store.saveJob(job);
      return;
    }
    job.status = 'RUNNING';
    job.updatedAt = schema.nowIso();
    await store.saveJob(job);
    await store.addEvent({ job_id: job.id, type: 'compute.job.running', detail: job.route + ' executor' });
    try {
      const res = await exec.execute(job);
      if (res.text !== undefined) {
        const artDir = path.join(dirs.artifacts, job.id);
        try { fs.mkdirSync(artDir, { recursive: true }); } catch (e) {}
        const rp = path.join(artDir, 'result.json');
        const body = JSON.stringify({ job_id: job.id, status: 'COMPLETED', result: { text: res.text }, metrics: res.metrics || {} }, null, 2);
        try {
          fs.writeFileSync(rp, body, 'utf8');
          job.artifacts = [{ name: 'result.json', path: rp, bytes: Buffer.byteLength(body, 'utf8') }];
        } catch (e) {}
      }
      if (res.embeddings !== undefined) {
        const artDir = path.join(dirs.artifacts, job.id);
        try { fs.mkdirSync(artDir, { recursive: true }); } catch (e) {}
        const ep = path.join(artDir, 'embeddings.json');
        const ebody = JSON.stringify({ job_id: job.id, model: (res.metrics && res.metrics.model) || '', dims: (res.metrics && res.metrics.dims) || 0, count: res.embeddings.length, embeddings: res.embeddings });
        try {
          fs.writeFileSync(ep, ebody, 'utf8');
          job.artifacts = [{ name: 'embeddings.json', path: ep, bytes: Buffer.byteLength(ebody, 'utf8') }];
        } catch (e) {}
        job.metrics = Object.assign({}, res.metrics, { embeddings: res.embeddings.length });
      } else {
        job.metrics = res.metrics || {};
      }
      job.error = null;
      job.status = 'COMPLETED';
      job.progress = 1;
      job.updatedAt = schema.nowIso();
      await store.saveJob(job);
      await store.addEvent({ job_id: job.id, type: 'compute.job.completed', detail: 'via ' + job.route });
    } catch (e) {
      const code = (e && e.code) || 'UNKNOWN';
      job.status = 'FAILED';
      job.error = { code, message: String((e && e.message) || e).slice(0, 500), retryable: !['MODEL_NOT_FOUND', 'INVALID_JOB', 'PRIVACY_REJECTED'].includes(code), action: 'See message; fix and resubmit if retryable.' };
      job.updatedAt = schema.nowIso();
      await store.saveJob(job);
      await store.addEvent({ job_id: job.id, type: 'compute.job.failed', detail: code + ': ' + job.error.message.slice(0, 200) });
    }
  }

  return {
    dirs, getProviders, getWorkers, getQuota, estimate, decideRoute,
    submitJob, cancelJob, heartbeat, importResult, workerOnline, syncKaggleJob, runLocalCloud,
    kaggleEnabled: () => kaggleEnabled(), MODEL_DEFAULTS,
  };
}

module.exports = { createComputeManager, detectLocal, cloudStatus, kaggleEnabled, computeDirs, MODEL_DEFAULTS };
