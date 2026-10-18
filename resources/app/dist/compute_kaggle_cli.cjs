'use strict';
/**
 * MYRAA Compute — Kaggle CLI transport (Phase 7b).
 * Legitimate async mechanism only: `kaggle kernels push` (run) ->
 * `kernels status` (poll) -> `kernels output` (fetch). No tunnels, no invented
 * APIs, no quota bypass. Credentials: KAGGLE_API_TOKEN env (or vault-backed
 * ids kaggle_api_token / KAGGLE_API_TOKEN); never written into kernel dirs,
 * never logged (sanitizer runs over all captured output).
 * Status mapping is defensive: unknown states stay RUNNING/UNKNOWN, never
 * invented as terminal.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const schema = require('./compute_schema.cjs');

const ACCELERATORS = ['NvidiaTeslaT4', 'NvidiaL4', 'NvidiaTeslaA100', 'NvidiaL4X1', 'TpuV5E8', 'TpuV6E8', 'NvidiaH100', 'NvidiaRtxPro6000'];
const DEFAULT_ACCELERATOR = 'NvidiaTeslaT4';

function findKaggleBin() {
  const cands = [];
  try {
    const where = execFileSync('where', ['kaggle'], { timeout: 5000, windowsHide: true, encoding: 'utf8' });
    String(where || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).forEach((s) => cands.push(s));
  } catch (e) {}
  const appData = process.env.APPDATA || '';
  if (appData) {
    cands.push(path.join(appData, 'Python', 'Python314', 'Scripts', 'kaggle.exe'));
    cands.push(path.join(appData, 'Python', 'Python313', 'Scripts', 'kaggle.exe'));
  }
  for (const c of cands) {
    try { if (c && fs.existsSync(c)) return c; } catch (e) {}
  }
  return null;
}

function resolveToken() {
  const env = process.env;
  if (env.KAGGLE_API_TOKEN && String(env.KAGGLE_API_TOKEN).trim().length > 8) {
    return { ok: true, token: String(env.KAGGLE_API_TOKEN).trim(), source: 'env' };
  }
  try {
    const vault = require('./secure_vault.cjs');
    const t = vault.getSecret('kaggle_api_token') || vault.getSecret('KAGGLE_API_TOKEN') || '';
    if (t && String(t).trim().length > 8) return { ok: true, token: String(t).trim(), source: 'vault' };
  } catch (e) { /* vault unavailable */ }
  return { ok: false, error: 'No Kaggle credential. Run `kaggle auth login` once, or set KAGGLE_API_TOKEN (env/vault id kaggle_api_token).' };
}

function availability() {
  const bin = findKaggleBin();
  if (!bin) return { ok: false, code: 'NOT_CONFIGURED', error: 'kaggle CLI not found. Run: pip install kaggle.' };
  const cred = resolveToken();
  if (!cred.ok) return { ok: false, code: 'NOT_CONFIGURED', error: cred.error };
  return { ok: true, bin, tokenSource: cred.source };
}

function runKaggle(bin, token, args, timeoutMs) {
  const env = Object.assign({}, process.env, { KAGGLE_API_TOKEN: token });
  try {
    const out = execFileSync(bin, args, { timeout: timeoutMs || 120000, windowsHide: true, encoding: 'utf8', env, maxBuffer: 8 * 1024 * 1024 });
    return { ok: true, out: String(out || '') };
  } catch (e) {
    const scrubbed = schema.sanitizeSecrets(String((e && e.message) || e) + '\n' + String(e.stdout || '') + String(e.stderr || ''));
    return { ok: false, error: scrubbed.text.slice(0, 500) };
  }
}

function authorKernelDir(dir, opts) {
  // opts: {slug, title, notebookJson, accelerator, private, enableInternet, timeout}
  const o = opts || {};
  const slug = String(o.slug || '');
  if (!slug || slug.indexOf('/') < 0) return { ok: false, error: 'kernel slug must be owner/name' };
  const accelerator = ACCELERATORS.includes(o.accelerator) ? o.accelerator : DEFAULT_ACCELERATOR;
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {
    return { ok: false, error: 'cannot create kernel dir: ' + String(e.message || e) };
  }
  const codeFile = 'myraa_worker.ipynb';
  try {
    fs.writeFileSync(path.join(dir, codeFile), typeof o.notebookJson === 'string' ? o.notebookJson : JSON.stringify(o.notebookJson, null, 1), 'utf8');
    const meta = {
      id: slug, title: String(o.title || slug.split('/')[1] || 'myraa-worker'),
      code_file: codeFile, language: 'python', kernel_type: 'notebook',
      is_private: o.private === false ? 'false' : 'true',
      enable_gpu: 'true', enable_internet: o.enableInternet === true ? 'true' : 'false',
      machine_shape: accelerator,
      dataset_sources: [], competition_sources: [], kernel_sources: [], model_sources: [],
    };
    fs.writeFileSync(path.join(dir, 'kernel-metadata.json'), JSON.stringify(meta, null, 2), 'utf8');
  } catch (e) {
    return { ok: false, error: 'cannot write kernel files: ' + String(e.message || e) };
  }
  // Safety: staged dir must never contain secrets.
  const scan = schema.sanitizeSecrets(fs.readFileSync(path.join(dir, codeFile), 'utf8'));
  if (scan.redactions > 0) return { ok: false, error: 'refusing to push: job payload looks like it contains secrets (' + scan.redactions + ' redactions). Sanitize first.' };
  return { ok: true, dir, codeFile, accelerator };
}

// Render the base worker notebook with a job embedded in JOB_JSON_INLINE.
function renderJobNotebook(baseNotebookJson, jobPayload) {
  const nb = typeof baseNotebookJson === 'string' ? JSON.parse(baseNotebookJson) : JSON.parse(JSON.stringify(baseNotebookJson));
  const jobStr = JSON.stringify(jobPayload);
  // Escape for embedding inside a Python string cell.
  const pyLiteral = JSON.stringify(jobStr);
  let replaced = false;
  for (const cell of (nb.cells || [])) {
    if (cell.cell_type !== 'code') continue;
    const src = Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || '');
    if (src.indexOf('JOB_JSON_INLINE = ') >= 0) {
      const lines = (Array.isArray(cell.source) ? cell.source : src.split('\n')).map((ln) => String(ln));
      const next = lines.map((ln) => (/^JOB_JSON_INLINE\s*=/.test(ln) ? 'JOB_JSON_INLINE = ' + pyLiteral : ln));
      cell.source = next.map((ln, i) => (i < next.length - 1 ? ln + (ln.endsWith('\n') ? '' : '\n') : ln));
      replaced = true;
      break;
    }
  }
  if (!replaced) return { ok: false, error: 'template notebook has no JOB_JSON_INLINE cell' };
  return { ok: true, notebookJson: nb };
}

// Kaggle kernel run states -> MYRAA mapping. Unknown stays non-terminal.
function mapStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return { state: 'RUNNING', detail: 'empty status (assuming active)' };
  if (s === 'complete' || s === 'completed' || s === 'success') return { state: 'COMPLETED', detail: s };
  if (s === 'error' || s === 'failed' || s === 'failure') return { state: 'FAILED', detail: s };
  if (s.indexOf('cancel') === 0) return { state: 'CANCELLED', detail: s };
  return { state: 'RUNNING', detail: s };
}

function pushRun(bin, token, dir, accelerator, timeoutSec) {
  const args = ['kernels', 'push', '-p', dir, '--accelerator', accelerator || DEFAULT_ACCELERATOR];
  if (timeoutSec && Number(timeoutSec) > 0) args.push('-t', String(Number(timeoutSec)));
  return runKaggle(bin, token, args, 180000);
}

function kernelStatus(bin, token, ref) {
  const r = runKaggle(bin, token, ['kernels', 'status', ref], 60000);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, raw: r.out.trim(), mapped: mapStatus(r.out) };
}

function kernelOutput(bin, token, ref, destDir, pattern) {
  try { fs.mkdirSync(destDir, { recursive: true }); } catch (e) {
    return { ok: false, error: 'cannot create dest dir' };
  }
  const args = ['kernels', 'output', ref, '-p', destDir, '-o', '-q'];
  if (pattern) args.push('--file-pattern', String(pattern));
  const r = runKaggle(bin, token, args, 300000);
  if (!r.ok) return { ok: false, error: r.error };
  let files = [];
  try {
    files = fs.readdirSync(destDir).map((n) => {
      const p = path.join(destDir, n);
      let bytes = 0;
      try { bytes = fs.statSync(p).size; } catch (e) {}
      return { name: n, bytes };
    });
  } catch (e) {}
  return { ok: true, files, destDir };
}

function kernelLogs(bin, token, ref) {
  const r = runKaggle(bin, token, ['kernels', 'logs', ref], 60000);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, logs: schema.sanitizeSecrets(r.out).text.slice(0, 8000) };
}

module.exports = {
  ACCELERATORS, DEFAULT_ACCELERATOR,
  findKaggleBin, resolveToken, availability, runKaggle,
  authorKernelDir, renderJobNotebook, mapStatus,
  pushRun, kernelStatus, kernelOutput, kernelLogs,
};
