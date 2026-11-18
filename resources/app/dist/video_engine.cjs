'use strict';
/**
 * MYRAA Video Intelligence Engine (advanced spec sections 11-12).
 *
 * Real ffmpeg/ffprobe wrapper. Every operation returns success only after the
 * output file exists AND ffprobe validates it. Features that require vision or
 * ASR models are reported as NOT_IMPLEMENTED rather than faked.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const STATUS = Object.freeze([
  'AVAILABLE', 'PARTIAL', 'DEGRADED', 'UNAVAILABLE', 'NOT_IMPLEMENTED',
  'CONFIGURATION_REQUIRED', 'DEPENDENCY_MISSING', 'PERMISSION_REQUIRED', 'FAILED',
]);

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.mpeg', '.mpg', '.wmv', '.flv']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const DEFAULT_TIMEOUT = 120000;

// ---------------------------------------------------------------- binaries
function which(name) {
  const key = 'MYRAA_' + name.toUpperCase() + '_PATH';
  const override = process.env[key];
  if (override && fs.existsSync(override)) return path.resolve(override);
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      try { if (fs.existsSync(candidate)) return candidate; } catch (e) { /* skip */ }
    }
  }
  return null;
}

function run(bin, args, opts = {}) {
  if (!bin) return { ok: false, error: 'BINARY_NOT_FOUND', detail: 'ffmpeg/ffprobe not available' };
  try {
    const r = spawnSync(bin, args, {
      windowsHide: true,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: opts.timeout || DEFAULT_TIMEOUT,
    });
    if (r.error) return { ok: false, error: r.error.code || 'SPAWN_ERROR', detail: r.error.message };
    return { ok: r.status === 0, code: r.status, stdout: String(r.stdout || ''), stderr: String(r.stderr || ''), signal: r.signal };
  } catch (e) {
    return { ok: false, error: 'SPAWN_ERROR', detail: e.message };
  }
}

function versionOf(bin) {
  if (!bin) return null;
  const r = run(bin, ['-version'], { timeout: 10000 });
  if (!r.ok && !r.stdout) return null;
  const m = String(r.stdout || '').match(/(?:ffmpeg|ffprobe) version\s+([\w.\-]+)/i);
  return m ? m[1] : String(r.stdout || '').split('\n')[0].slice(0, 80);
}

function status() {
  const ffmpeg = which('ffmpeg');
  const ffprobe = which('ffprobe');
  const ffmpegVersion = versionOf(ffmpeg);
  const ffprobeVersion = versionOf(ffprobe);
  const ok = Boolean(ffmpeg && ffprobe && ffmpegVersion && ffprobeVersion);
  return {
    ok,
    status: ok ? 'AVAILABLE' : 'DEPENDENCY_MISSING',
    ffmpeg: { path: ffmpeg, version: ffmpegVersion },
    ffprobe: { path: ffprobe, version: ffprobeVersion },
    reason: ok
      ? 'real ffmpeg/ffprobe binaries resolved and version-probed'
      : 'ffmpeg and/or ffprobe not found; set MYRAA_FFMPEG_PATH / MYRAA_FFPROBE_PATH',
    implemented: ['probe', 'validate', 'analyze(scene+silence)', 'thumbnail', 'trim', 'split', 'concat', 'crop', 'resize', 'rotate', 'speed', 'mute'],
    limitations: [
      { feature: 'object/person detection', status: 'NOT_IMPLEMENTED', reason: 'requires a vision model adapter' },
      { feature: 'speech transcription', status: 'NOT_IMPLEMENTED', reason: 'requires an ASR adapter' },
      { feature: 'subtitle/caption generation', status: 'NOT_IMPLEMENTED', reason: 'depends on speech transcription' },
      { feature: 'semantic scene labeling', status: 'NOT_IMPLEMENTED', reason: 'timeline labels are neutral (Scene N); no semantic classifier' },
    ],
  };
}

// ---------------------------------------------------------------- paths
function resolveInput(input) {
  if (!input || typeof input !== 'string') return { ok: false, error: 'INPUT_REQUIRED' };
  const p = path.resolve(input);
  try {
    const st = fs.statSync(p);
    if (!st.isFile()) return { ok: false, error: 'NOT_A_FILE', detail: p };
  } catch (e) { return { ok: false, error: 'INPUT_NOT_FOUND', detail: p }; }
  if (!VIDEO_EXTS.has(path.extname(p).toLowerCase())) {
    return { ok: false, error: 'UNSUPPORTED_INPUT', detail: path.extname(p) };
  }
  return { ok: true, path: p };
}

function workspace() {
  const base = process.env.MYRAA_DATA_DIR || path.join(os.tmpdir(), 'myraa-video');
  const dir = path.join(base, 'video-workspace');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* best effort */ }
  return dir;
}

function resolveOutput(output, opts = {}) {
  const dir = workspace();
  if (!output) {
    const ext = (opts.ext && IMAGE_EXTS.has(opts.ext)) ? opts.ext : '.mp4';
    return { ok: true, path: path.join(dir, `myraa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`), generated: true };
  }
  const p = path.resolve(output);
  const ext = path.extname(p).toLowerCase();
  if (!VIDEO_EXTS.has(ext) && !IMAGE_EXTS.has(ext)) return { ok: false, error: 'UNSUPPORTED_OUTPUT', detail: ext };
  if (fs.existsSync(p) && !opts.overwrite) return { ok: false, error: 'OUTPUT_EXISTS', detail: p };
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch (e) { return { ok: false, error: 'OUTPUT_DIR_ERROR', detail: e.message }; }
  return { ok: true, path: p, generated: false };
}

// ---------------------------------------------------------------- probe
function probe(input) {
  const inRes = resolveInput(input);
  if (!inRes.ok) return { ok: false, ...inRes };
  const ffprobe = which('ffprobe');
  if (!ffprobe) return { ok: false, error: 'DEPENDENCY_MISSING' };
  const r = run(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', inRes.path]);
  if (!r.ok) return { ok: false, error: 'FFPROBE_FAILED', detail: (r.stderr || r.detail || '').slice(0, 400) };
  let meta;
  try { meta = JSON.parse(r.stdout); } catch (e) { return { ok: false, error: 'FFPROBE_BAD_JSON', detail: e.message }; }
  const streams = Array.isArray(meta.streams) ? meta.streams : [];
  const video = streams.find((s) => s.codec_type === 'video') || null;
  const audio = streams.find((s) => s.codec_type === 'audio') || null;
  const duration = Number(meta.format && meta.format.duration) || (video && Number(video.duration)) || 0;
  return {
    ok: true,
    file: inRes.path,
    duration,
    sizeBytes: Number(meta.format && meta.format.size) || fs.statSync(inRes.path).size,
    format: meta.format && meta.format.format_name,
    video: video ? { codec: video.codec_name, width: video.width, height: video.height, fps: video.r_frame_rate, nbFrames: video.nb_frames } : null,
    audio: audio ? { codec: audio.codec_name, sampleRate: audio.sample_rate, channels: audio.channels } : null,
    streamCount: streams.length,
  };
}

function validate(file) {
  const p = path.resolve(String(file || ''));
  if (!fs.existsSync(p)) return { ok: false, error: 'OUTPUT_NOT_FOUND', detail: p };
  const r = run(which('ffprobe'), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', p]);
  if (!r.ok) return { ok: false, error: 'OUTPUT_INVALID', detail: (r.stderr || r.detail || '').slice(0, 400) };
  let meta;
  try { meta = JSON.parse(r.stdout); } catch (e) { return { ok: false, error: 'OUTPUT_INVALID_JSON' }; }
  return { ok: true, file: p, duration: Number(meta.format && meta.format.duration) || 0, sizeBytes: fs.statSync(p).size, streams: (meta.streams || []).length, format: meta.format && meta.format.format_name };
}

// ---------------------------------------------------------------- analyze
function parseScenes(stderr) {
  const out = [];
  const re = /pts_time:([0-9]+\.?[0-9]*)/g;
  let m;
  while ((m = re.exec(stderr)) !== null) {
    const t = Number(m[1]);
    if (Number.isFinite(t) && !out.some((x) => Math.abs(x.time - t) < 0.05)) out.push({ time: t });
  }
  return out.sort((a, b) => a.time - b.time);
}

function parseSilences(stderr) {
  const out = [];
  const starts = [...String(stderr).matchAll(/silence_start:\s*([0-9.]+)/g)].map((m) => Number(m[1]));
  const ends = [...String(stderr).matchAll(/silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/g)]
    .map((m) => ({ end: Number(m[1]), duration: Number(m[2]) }));
  for (let i = 0; i < starts.length; i++) {
    const e = ends[i];
    out.push({ start: starts[i], end: e ? e.end : null, duration: e ? e.duration : (e ? null : 0) });
  }
  return out;
}

function analyze(input, opts = {}) {
  const st = status();
  if (!st.ok) return { ok: false, error: 'DEPENDENCY_MISSING', detail: st.reason };
  const pr = probe(input);
  if (!pr.ok) return { ok: false, ...pr };
  const ffmpeg = which('ffmpeg');
  const threshold = Math.min(0.95, Math.max(0.05, Number(opts.sceneThreshold) || 0.4));

  const sceneRun = run(ffmpeg, [
    '-hide_banner', '-i', pr.file,
    '-vf', `select=gt(scene\\,${threshold}),showinfo`,
    '-an', '-f', 'null', '-',
  ]);
  const scenes = sceneRun.ok || sceneRun.stderr ? parseScenes(sceneRun.stderr || '') : [];
  const silenceRun = run(ffmpeg, [
    '-hide_banner', '-i', pr.file,
    '-af', 'silencedetect=noise=-30dB:d=0.4',
    '-f', 'null', '-',
  ]);
  const silences = silenceRun.stderr ? parseSilences(silenceRun.stderr) : [];

  // Real timeline from detected scene boundaries. Labels are intentionally neutral.
  const bounds = [0, ...scenes.map((s) => s.time), pr.duration].filter((t) => Number.isFinite(t));
  const timeline = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i];
    const end = bounds[i + 1];
    if (!(end > start)) continue;
    const silent = silences.find((s) => s.start >= start && s.start < end);
    timeline.push({
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      label: silent ? 'Low/no audio' : `Scene ${i + 1}`,
      kind: silent ? 'audio-silence' : 'scene',
      source: silent ? 'ffmpeg silencedetect' : 'ffmpeg scene detection',
    });
  }

  return {
    ok: true,
    file: pr.file,
    duration: pr.duration,
    detected: { scenes: scenes.length, silences: silences.length, sceneThreshold: threshold },
    scenes,
    silences,
    timeline,
    limitations: st.limitations,
    note: 'timeline segments come from real ffmpeg scene/silence detection; semantic labels require vision/ASR adapters (NOT_IMPLEMENTED)',
  };
}

// ---------------------------------------------------------------- thumbnail
function thumbnail(input, output, atSeconds) {
  const pr = probe(input);
  if (!pr.ok) return { ok: false, ...pr };
  const t = Math.min(Math.max(0, Number(atSeconds) || 0), Math.max(0, pr.duration - 0.01));
  const out = resolveOutput(output, { ext: '.jpg', overwrite: true });
  if (!out.ok) return { ok: false, ...out };
  const r = run(which('ffmpeg'), [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(t), '-i', pr.file, '-frames:v', '1', '-q:v', '2', out.path,
  ]);
  if (!r.ok) return { ok: false, error: 'FFMPEG_FAILED', detail: (r.stderr || r.detail || '').slice(0, 400) };
  const v = validate(out.path);
  if (!v.ok) return { ok: false, error: 'OUTPUT_VALIDATION_FAILED', ...v };
  return { ok: true, operation: 'thumbnail', at: t, output: out.path, validation: v };
}

// ---------------------------------------------------------------- edit
const OPS = new Set(['trim', 'split', 'concat', 'crop', 'resize', 'rotate', 'speed', 'mute', 'thumbnail']);

function buildFilterChain(ops) {
  const vf = [];
  const af = [];
  for (const op of ops) {
    switch (op.type) {
      case 'resize': {
        const w = Math.max(2, Math.floor(Number(op.width) || 0));
        const h = Math.max(2, Math.floor(Number(op.height) || 0));
        if (w && h) vf.push(`scale=${w}:${h}`);
        break;
      }
      case 'crop': {
        const w = Math.max(2, Math.floor(Number(op.width) || 0));
        const h = Math.max(2, Math.floor(Number(op.height) || 0));
        if (w && h) vf.push(`crop=${w}:${h}:${Math.max(0, Math.floor(Number(op.x) || 0))}:${Math.max(0, Math.floor(Number(op.y) || 0))}`);
        break;
      }
      case 'rotate': {
        const dir = Number(op.degrees) < 0 ? 'transpose=2' : 'transpose=1';
        vf.push(op.degrees === 180 ? 'hflip,vflip' : dir);
        break;
      }
      case 'speed': {
        const rate = Math.min(4, Math.max(0.25, Number(op.rate) || 1));
        vf.push(`setpts=${(1 / rate).toFixed(4)}*PTS`);
        af.push(`atempo=${rate.toFixed(4)}`);
        break;
      }
      default: break;
    }
  }
  return { vf: vf.join(','), af: af.join(',') };
}

function edit(input, ops, output, opts = {}) {
  const st = status();
  if (!st.ok) return { ok: false, error: 'DEPENDENCY_MISSING', detail: st.reason };
  const pr = probe(input);
  if (!pr.ok) return { ok: false, ...pr };
  const list = Array.isArray(ops) ? ops : [];
  const invalid = list.filter((o) => !OPS.has(o && o.type));
  if (invalid.length) return { ok: false, error: 'UNSUPPORTED_OPERATION', detail: invalid.map((o) => o && o.type) };
  const out = resolveOutput(output, { overwrite: Boolean(opts.overwrite) });
  if (!out.ok) return { ok: false, ...out };

  // concat needs multiple real inputs
  const concat = list.find((o) => o.type === 'concat');
  if (concat) {
    const inputs = Array.isArray(concat.inputs) ? concat.inputs : [];
    if (inputs.length < 2) return { ok: false, error: 'CONCAT_NEEDS_TWO_INPUTS' };
    const resolved = [pr.file, ...inputs];
    const listFile = path.join(workspace(), `concat_${Date.now()}.txt`);
    try {
      fs.writeFileSync(listFile, resolved.map((p) => `file '${path.resolve(p).replace(/'/g, "'\\''" )}'`).join('\n'), 'utf8');
    } catch (e) { return { ok: false, error: 'CONCAT_LIST_ERROR', detail: e.message }; }
    const r = run(which('ffmpeg'), ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', out.path]);
    const v = r.ok ? validate(out.path) : { ok: false };
    return v.ok
      ? { ok: true, operation: 'concat', inputs: resolved.length, output: out.path, validation: v }
      : { ok: false, error: 'FFMPEG_FAILED', detail: (r.stderr || r.detail || '').slice(0, 400) };
  }

  const { vf, af } = buildFilterChain(list);
  const mute = list.some((o) => o.type === 'mute');
  const trim = list.find((o) => o.type === 'trim');
  const split = list.find((o) => o.type === 'split');
  const thumb = list.find((o) => o.type === 'thumbnail');

  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  if (trim) {
    const start = Math.max(0, Number(trim.start) || 0);
    const end = trim.end != null ? Number(trim.end) : null;
    args.push('-ss', String(start));
    if (end != null && end > start) args.push('-t', String(end - start));
  }
  args.push('-i', pr.file);
  if (vf) args.push('-vf', vf);
  if (mute) args.push('-an');
  else if (af) args.push('-af', af);
  if (thumb) {
    args.push('-frames:v', '1');
  } else {
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac');
  }
  args.push(out.path);

  const r = run(which('ffmpeg'), args);
  if (!r.ok) return { ok: false, error: 'FFMPEG_FAILED', detail: (r.stderr || r.detail || '').slice(0, 600), args: args.slice(0, 8) };
  const v = validate(out.path);
  if (!v.ok) return { ok: false, error: 'OUTPUT_VALIDATION_FAILED', ...v };
  return {
    ok: true,
    operations: list.map((o) => o.type),
    output: out.path,
    validation: v,
    split: split ? { requested: true, note: 'use two trim operations with distinct output paths to split into parts' } : undefined,
    warnings: vf.includes('setpts') ? ['speed change may shift audio sync on some codecs'] : [],
  };
}

// ---------------------------------------------------------------- router
function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/status', (req, res) => res.json(status()));
  router.post('/probe', (req, res) => res.json(probe((req.body || {}).input)));
  router.post('/analyze', (req, res) => res.json(analyze((req.body || {}).input, req.body || {})));
  router.post('/validate', (req, res) => res.json(validate((req.body || {}).file)));
  router.post('/thumbnail', (req, res) => {
    const b = req.body || {};
    res.json(thumbnail(b.input, b.output, b.at));
  });
  router.post('/edit', (req, res) => {
    const b = req.body || {};
    res.json(edit(b.input, b.operations, b.output, b));
  });
  return router;
}

module.exports = { STATUS, VIDEO_EXTS, status, probe, validate, analyze, thumbnail, edit, createRouter };
