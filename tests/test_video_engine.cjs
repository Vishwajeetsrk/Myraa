'use strict';
// Video Intelligence Engine: every check runs real ffmpeg/ffprobe on a real generated clip.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const ve = require(path.join(DIST, 'video_engine.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

function resolveBin(name) {
  const override = process.env['MYRAA_' + name.toUpperCase() + '_PATH'];
  if (override && fs.existsSync(override)) return override;
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of String(process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const p = path.join(dir, name + ext);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

(async () => {
  const st = ve.status();
  check('ffmpeg/ffprobe resolved and version-probed', st.ok && st.status === 'AVAILABLE' && !!st.ffmpeg.version && !!st.ffprobe.version, JSON.stringify(st.ffmpeg));
  check('vision/ASR gaps are honestly NOT_IMPLEMENTED', st.limitations.some((l) => l.status === 'NOT_IMPLEMENTED' && /transcription|object|semantic/i.test(l.feature)));
  check('status vocabulary has no fake CONNECTED/ACTIVE', !ve.STATUS.includes('CONNECTED') && !ve.STATUS.includes('ACTIVE'));

  const ffmpeg = resolveBin('ffmpeg');
  check('test ffmpeg executable present', !!ffmpeg);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_vid_test_'));
  const input = path.join(dir, 'source.mp4');

  const gen = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc=duration=2:size=160x120:rate=10',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', input,
  ], { windowsHide: true, encoding: 'utf8' });
  check('real test video generated', gen.status === 0 && fs.existsSync(input), (gen.stderr || '').slice(0, 200));
  if (!fs.existsSync(input)) { console.log('\nvideo engine tests: ' + pass + ' pass, ' + fail + ' fail'); process.exit(1); }

  const pr = ve.probe(input);
  check('probe returns real metadata', pr.ok && pr.duration > 1.5 && pr.duration < 2.5 && pr.video && pr.video.codec, JSON.stringify(pr).slice(0, 200));
  check('probe detects real audio stream', !!pr.audio, JSON.stringify(pr.audio));

  const val = ve.validate(input);
  check('validate confirms a real media file', val.ok && val.streams >= 2 && val.sizeBytes > 1000, JSON.stringify(val));

  const thumbPath = path.join(dir, 'thumb.jpg');
  const th = ve.thumbnail(input, thumbPath, 0.5);
  check('thumbnail extracted and validated', th.ok && fs.existsSync(thumbPath) && th.validation.ok, JSON.stringify(th).slice(0, 200));

  const trimPath = path.join(dir, 'trim.mp4');
  const tr = ve.edit(input, [{ type: 'trim', start: 0.2, end: 1.2 }], trimPath, { overwrite: true });
  const trVal = tr.ok ? ve.probe(trimPath) : null;
  check('trim produced a validated shorter clip', tr.ok && trVal && trVal.duration > 0.5 && trVal.duration < 1.4, JSON.stringify(tr).slice(0, 200));

  const mutePath = path.join(dir, 'mute.mp4');
  const mu = ve.edit(input, [{ type: 'mute' }], mutePath, { overwrite: true });
  const muPr = mu.ok ? ve.probe(mutePath) : null;
  check('mute removed the audio stream', mu.ok && muPr && muPr.audio === null, JSON.stringify(mu).slice(0, 200));

  const an = ve.analyze(input);
  check('analyze returns a real timeline', an.ok && an.timeline.length > 0 && an.duration > 1.5, JSON.stringify(an).slice(0, 200));
  check('analyze keeps honest semantic limitations', Array.isArray(an.limitations) && an.limitations.length >= 3);
  check('analyze never claims object/people detection', !/detected (objects|people|speech)/i.test(JSON.stringify(an)));

  const bad = ve.edit(input, [{ type: 'teleport' }], path.join(dir, 'bad.mp4'));
  check('unsupported operation rejected', !bad.ok && bad.error === 'UNSUPPORTED_OPERATION');

  const missing = ve.probe(path.join(dir, 'nope.mp4'));
  check('missing input rejected honestly', !missing.ok && missing.error === 'INPUT_NOT_FOUND');

  const router = ve.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes probe/analyze/edit/status', ['/status', '/probe', '/analyze', '/edit'].every((p) => paths.includes(p)));

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp only */ }
  console.log('\nvideo engine tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.stack || e)); process.exit(1); });
