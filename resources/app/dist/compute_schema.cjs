'use strict';
/**
 * MYRAA Compute — schemas, placement rules, sanitizer (Phase 7).
 * Zero dependencies. Unknowns are UNKNOWN, never fabricated.
 * Memory model: NEVER treat aggregate VRAM as a single pool.
 */

const PROVIDERS = ['local', 'cloud_api', 'kaggle'];
const ROUTE_MODES = ['AUTO', 'LOCAL', 'CLOUD', 'KAGGLE', 'MANUAL'];
const COMPUTE_PREFS = ['AUTO', 'LOCAL', 'CLOUD', 'KAGGLE', 'MANUAL'];
const JOB_TYPES = ['CHAT_INFERENCE', 'LLM_INFERENCE', 'EMBEDDING', 'RERANKING',
  'DOCUMENT_BATCH', 'IMAGE_INFERENCE', 'AUDIO_PROCESSING', 'MODEL_EVALUATION',
  'QLORA_TRAINING', 'TRAINING', 'COURSE_ASSET_GENERATION', 'TRANSCRIPTION', 'BATCH_INFERENCE'];
const JOB_STATUSES = ['CREATED', 'QUEUED', 'VALIDATING', 'PREPARING', 'LOADING_MODEL',
  'RUNNING', 'FINALIZING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED', 'RETRYING'];
const FAILURE_CODES = ['GPU_OOM', 'MODEL_LOAD_FAILED', 'CUDA_ERROR', 'NCCL_ERROR',
  'WORKER_OFFLINE', 'QUOTA_EXHAUSTED', 'NETWORK_ERROR', 'INVALID_JOB', 'MODEL_NOT_FOUND',
  'MODEL_VRAM_INSUFFICIENT', 'ARTIFACT_ERROR', 'TIMEOUT', 'PRIVACY_REJECTED', 'PROVIDER_DISABLED', 'UNKNOWN'];

function makeId(prefix) {
  return (prefix || 'cmp') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
function nowIso() { return new Date().toISOString(); }

// Explicit, documented estimate: params(B) x bytes/param x 1.2 overhead + context reserve.
const BYTES_PER_PARAM = { fp32: 4, fp16: 2, bf16: 2, int8: 1, int4: 0.5 };
function estimateModelGB(paramsB, quantization, contextTokens) {
  const bpp = BYTES_PER_PARAM[String(quantization || 'fp16').toLowerCase()];
  if (!(paramsB > 0) || !bpp) return { ok: false, uncertain: true, reason: 'unknown params or quantization' };
  const weights = paramsB * bpp;
  const ctxGB = Math.max(0.5, ((contextTokens || 4096) * 0.0004));
  const total = Math.round((weights * 1.2 + ctxGB) * 100) / 100;
  return { ok: true, estimatedGB: total, formula: 'paramsB*bpp*1.2+ctx', uncertain: false };
}

// Placement: returns {place:'single'|'sharded'|'refused', code?, detail}
function placeModel(estimatedGB, caps, opts) {
  const o = opts || {};
  const single = Number(caps && caps.single_gpu_vram_gb) || 0;
  const agg = Number(caps && caps.aggregate_vram_gb) || 0;
  if (!(estimatedGB > 0)) return { place: 'refused', code: 'INVALID_JOB', detail: 'no VRAM estimate' };
  if (single > 0 && estimatedGB <= single) return { place: 'single', detail: 'fits one GPU' };
  const sharding = o.supportsSharding === true && caps && caps.multi_gpu === true;
  if (sharding && agg > 0 && estimatedGB <= agg) {
    return { place: 'sharded', detail: 'needs verified multi-GPU sharding' };
  }
  if (single > 0 && estimatedGB > single) {
    return { place: 'refused', code: 'MODEL_VRAM_INSUFFICIENT', detail: 'needs ' + estimatedGB + 'GB on one GPU; single capacity ' + single + 'GB' + (sharding ? '' : ' and no verified sharding') };
  }
  return { place: 'refused', code: 'MODEL_VRAM_INSUFFICIENT', detail: 'no usable GPU capacity reported' };
}

// Secret scrubber for job JSON, logs, prompts. Returns {text, redactions}.
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9-_]{8,}/g,
  /xox[bpas]-[A-Za-z0-9-]+/g,
  /gh[pousr]_[A-Za-z0-9_]{8,}/g,
  /AIza[A-Za-z0-9-_]{10,}/g,
  /AKIA[A-Z0-9]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /bearer\s+[A-Za-z0-9\-._~+/=]{8,}/gi,
  /\b(api[_-]?key|api[_-]?secret|secret|token|password|passwd|pwd)\s*[:=]\s*['"]?[^'"\s,}]{4,}['"]?/gi,
];
function sanitizeSecrets(input) {
  let text = typeof input === 'string' ? input : JSON.stringify(input);
  let redactions = 0;
  for (const re of SECRET_PATTERNS) {
    re.lastIndex = 0;
    text = text.replace(re, (m) => { redactions++; return '[REDACTED]'; });
  }
  return { text, redactions };
}

function validateJobSpec(b) {
  const errors = [];
  if (!b || typeof b !== 'object') return { ok: false, errors: ['body must be an object'] };
  if (!JOB_TYPES.includes(b.jobType)) errors.push('jobType must be one of: ' + JOB_TYPES.join(', '));
  if (b.route && !ROUTE_MODES.includes(String(b.route).toUpperCase())) errors.push('route must be one of: ' + ROUTE_MODES.join(', '));
  if (b.model && typeof b.model !== 'object') errors.push('model must be an object');
  if (b.priority !== undefined && !['low', 'normal', 'high'].includes(b.priority)) errors.push('priority must be low|normal|high');
  return { ok: errors.length === 0, errors };
}

module.exports = {
  PROVIDERS, ROUTE_MODES, COMPUTE_PREFS, JOB_TYPES, JOB_STATUSES, FAILURE_CODES,
  BYTES_PER_PARAM, makeId, nowIso,
  estimateModelGB, placeModel, sanitizeSecrets, validateJobSpec,
};
